export class AuthResultEntity {
  accessToken: string;
  username: string;

  constructor(accessToken: string, username: string) {
    this.accessToken = accessToken;
    this.username = username;
  }
}
