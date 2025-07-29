import { LeanDocument } from '@dals/mongo/base.repository';
import { User } from '@dals/mongo/schema';
import { HydratedDocument } from 'mongoose';
import { UserEntity } from '@entity';

export class UserMapper {
  public static toModel(entity: UserEntity): User {
    const model = new User();
    model.loginId = entity.loginId;
    model.password = entity.password;
    model.pinCode = entity.pinCode;
    model.role = entity.role;

    model.employeeId = entity.employeeId;
    model.cardNumber = entity.cardNumber;
    model.genealogy = entity.genealogy;

    model.cloud = entity.cloud;
    return model;
  }

  public static toEntity(model: User | HydratedDocument<User> | LeanDocument<User> | null): UserEntity | null {
    if (!model) {
      return null;
    }
    return this._toEntity(model);
  }

  private static _toEntity(model: User): UserEntity {
    return new UserEntity({
      id: model._id.toString(),
      loginId: model.loginId,
      password: model.password,
      pinCode: model.pinCode,
      role: model.role as any,
      employeeId: model.employeeId,
      cardNumber: model.cardNumber,
      genealogy: model.genealogy,
      cloud: model.cloud as any,
      createdAt: model.createdAt?.toISOString(),
      updatedAt: model.updatedAt?.toISOString(),
    });
  }

  public static toEntities(models: User[]): UserEntity[] {
    return models.map((model) => this._toEntity(model));
  }

  public static toModelArray(entities: UserEntity[]): User[] {
    return entities.map((entity) => this.toModel(entity));
  }
}
