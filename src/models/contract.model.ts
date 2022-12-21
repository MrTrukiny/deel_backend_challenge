import { DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '.';
import { ContractStatus } from '../types/contract.types';
import Job from './job.model';

class Contract extends Model<InferAttributes<Contract>, InferCreationAttributes<Contract>> {}
Contract.init(
  {
    terms: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(
        ContractStatus.NEW,
        ContractStatus.IN_PROGRESS,
        ContractStatus.TERMINATED,
      ),
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
