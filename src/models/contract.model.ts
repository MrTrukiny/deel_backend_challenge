import { DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import Job from './job.model';

class Contract extends Model<InferAttributes<Contract>, InferCreationAttributes<Contract>> {}
Contract.init(
  {
    terms: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('new', 'in_progress', 'terminated'),
    },
  },
  {
    sequelize,
    modelName: 'Contract',
  },
);

Contract.hasMany(Job);
Job.belongsTo(Contract);

export default Contract;
