import { DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import Contract from './contract.model';

class Profile extends Model<InferAttributes<Profile>, InferCreationAttributes<Profile>> {}
Profile.init(
  {
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    profession: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    balance: {
      type: DataTypes.DECIMAL(12, 2),
    },
    type: {
      type: DataTypes.ENUM('client', 'contractor'),
    },
  },
  {
    sequelize,
    modelName: 'Profile',
  },
);

Profile.hasMany(Contract, { as: 'contractor', foreignKey: 'contractorId' });
Contract.belongsTo(Profile, { as: 'contractor' });
Profile.hasMany(Contract, { as: 'client', foreignKey: 'clientId' });
Contract.belongsTo(Profile, { as: 'client' });

export default Profile;
