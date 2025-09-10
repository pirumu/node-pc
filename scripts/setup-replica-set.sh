#!/bin/bash

echo "Setting up MongoDB Replica Set..."

HOST_IP=$(hostname -I | awk '{print $1}')

if [ -z "$HOST_IP" ]; then
    HOST_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
fi

if [ -z "$HOST_IP" ]; then
    HOST_IP=$(docker network inspect bridge | grep "Gateway" | awk -F'"' '{print $4}')
fi

echo "Detected Host IP: $HOST_IP"

echo "Waiting for MongoDB to be ready..."
until docker exec mongo_primary mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; do
    echo "MongoDB not ready yet. Retrying..."
    sleep 2
done

echo "MongoDB is ready. Initializing replica set..."

docker exec mongo_primary mongosh --eval "
rs.initiate({
  _id: 'rs0',
  members: [
    { _id: 0, host: '$HOST_IP:20211' },
    { _id: 1, host: '$HOST_IP:20212' }
  ]
});
"

echo "Waiting for replica set to be ready..."
sleep 10

docker exec mongo_primary mongosh --eval "rs.status()"

echo "Setup complete!"
echo "Connection string: mongodb://$HOST_IP:20211,$HOST_IP:20212/your-database?replicaSet=rs0"
