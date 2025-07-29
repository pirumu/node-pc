import { IAppEvent } from '@common/interfaces';
import { Properties } from '@framework/types';

export class UserHadBeenDeletedEvent implements IAppEvent {
  public readonly userLogin: string;
  public readonly removedBy: string;

  constructor(props: Properties<UserHadBeenDeletedEvent>) {
    Object.assign(this, props);
  }

  public getChannel(): string {
    return 'user/remove/' + this.userLogin;
  }

  public getPayload() {
    return {
      userLogin: this.userLogin,
      removedBy: this.removedBy,
    };
  }
}
