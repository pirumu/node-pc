#!/bin/bash

echo "Setting up/Updating MongoDB Replica Set..."

HOST_OVERRIDE=$1
FINAL_HOST=""

if [ -n "$HOST_OVERRIDE" ]; then
    echo "Using provided host override: $HOST_OVERRIDE"
    FINAL_HOST=$HOST_OVERRIDE
else
    echo "No host override provided. Detecting host IP automatically..."
    HOST_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
    if [ -z "$HOST_IP" ]; then
        HOST_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
    fi
    if [ -z "$HOST_IP" ]; then
        HOST_IP=$(ipconfig getifaddr en0 2>/dev/null)
    fi
    if [ -z "$HOST_IP" ]; then
        HOST_IP=$(docker network inspect bridge | grep "Gateway" | awk -F'"' '{print $4}')
    fi
    if [ -z "$HOST_IP" ]; then
        echo "Error: Could not detect host IP. Please provide it as an argument."
        exit 1
    fi
    echo "Detected Host IP: $HOST_IP"
    FINAL_HOST=$HOST_IP
fi

echo "Waiting for MongoDB to be ready..."
until docker exec mongo_primary mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; do
    echo "MongoDB not ready yet. Retrying..."
    sleep 2
done
echo "MongoDB is ready."

REPLICA_SET_STATUS=$(docker exec mongo_primary mongosh --quiet --eval "rs.status()" 2>&1)

if [[ $REPLICA_SET_STATUS == *"no replica set config"* || $REPLICA_SET_STATUS == *"not running with --replSet"* ]]; then
    echo "Replica set not initialized. Initializing now with host: $FINAL_HOST"

    docker exec mongo_primary mongosh --eval "
    rs.initiate({
      _id: 'rs0',
      members: [
        { _id: 0, host: '$FINAL_HOST:20211' },
        { _id: 1, host: '$FINAL_HOST:20212' }
      ]
    });
    "
    echo "Waiting for replica set to be ready after initialization..."
    sleep 10
else
    echo "Replica set is already initialized. Checking configuration..."

    CURRENT_HOST=$(docker exec mongo_primary mongosh --quiet --eval "rs.conf().members[0].host")

    if [[ "$CURRENT_HOST" != "$FINAL_HOST"* ]]; then
        echo "Host mismatch detected. Current: $CURRENT_HOST, Desired: $FINAL_HOST. Reconfiguring..."

        docker exec mongo_primary mongosh --eval "
        var cfg = rs.conf();

        cfg.members[0].host = '$FINAL_HOST:20211';
        cfg.members[1].host = '$FINAL_HOST:20212';

        rs.reconfig(cfg, { force: true });
        "
        echo "Reconfiguration command sent. Waiting for replica set to stabilize..."
        sleep 15
    else
        echo "Configuration is already up-to-date. No changes needed."
    fi
fi

echo "Final replica set status:"
docker exec mongo_primary mongosh --eval "rs.status()"

echo "Setup complete!"
echo "Connection string: mongodb://$FINAL_HOST:20211,$FINAL_HOST:20212/your-database?replicaSet=rs0"
