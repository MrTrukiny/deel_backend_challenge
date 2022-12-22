import express from 'express';
import { Op } from 'sequelize';
import { sequelize } from './models';
import { getProfile } from './middleware/getProfile.middleware';
import { ContractStatus } from './types/contract.types';
const app = express();

app.use(express.json());
app.set('sequelize', sequelize);
app.set('models', sequelize.models);

/**
 * @description Get a contract if it is related to the profile
 * @returns a contract object or an error
 */
app.get('/api/v1/contracts/:contractId', getProfile, async (req, res) => {
  const { Contract } = req.app.get('models');
  const { contractId } = req.params;
  const { profile } = req;
  if (!profile) return res.status(404).json({ error: 'Contract not found' });

  const contract = await Contract.findOne({
    where: { id: contractId, [Op.or]: [{ clientId: profile.id }, { contractorId: profile.id }] },
  });
  if (!contract) return res.status(404).json({ error: 'Contract not found' });
  res.status(200).json({ data: { contract } });
});

/**
 * @description Get all contracts related to the profile
 * @returns an array of contracts or an error
 */
app.get('/api/v1/contracts', getProfile, async (req, res) => {
  const { Contract } = req.app.get('models');
  const { profile } = req;
  if (!profile) return res.status(404).json({ error: 'No Contracts found' });

  const contracts = await Contract.findAll({
    where: {
      [Op.or]: [{ clientId: profile.id }, { contractorId: profile.id }],
      status: { [Op.ne]: ContractStatus.TERMINATED },
    },
  });
  if (!contracts || !contracts.length) {
    return res.status(200).json({ message: 'There are no Contracts related to this Profile' });
  }

  res.status(200).json({ data: { contracts } });
});

/**
 * @description Get all unpaid jobs for a client or contractor for contracts that are in progress
 * @returns an array of jobs or an error
 */
app.get('/api/v1/jobs/unpaid', getProfile, async (req, res) => {
  const { Contract, Job } = req.app.get('models');
  const { profile } = req;
  if (!profile) return res.status(404).json({ error: 'No Jobs found' });

  const jobs = await Contract.findAll({
    attributes: [['id', 'contractId'], 'clientId', 'contractorId'],
    where: {
      [Op.or]: [{ clientId: profile.id }, { contractorId: profile.id }],
      status: ContractStatus.IN_PROGRESS,
    },
    include: {
      model: Job,
      as: 'jobs',
      where: { [Op.or]: [{ paid: false }, { paid: null }] },
    },
  });

  // This is another way to do it. It'd be nice to discover which is more performant.
  /* const jobs = await Job.findAll({
    where: {
      [Op.or]: [{ paid: paid === 'true' }, { paid: null }],
      contractId: {
        [Op.in]: sequelize.literal(
          `(SELECT id FROM Contracts WHERE clientId = ${profile.id} OR contractorId = ${profile.id})`,
        ),
      },
    },
  }); */

  if (!jobs || !jobs.length) {
    return res.status(200).json({ message: 'There are no Jobs related to this Profile' });
  }

  res.status(200).json({ data: { jobs } });
});

/**
 * @description Pay for a job which has a contract status in_progress. A client can only pay if his balance >= the amount to pay. The amount should be moved from the client's balance to the contractor balance.
 * @returns a success message or an error
 */
app.post('/api/v1/jobs/:jobId/pay', getProfile, async (req, res) => {
  const { Contract, Job, Profile } = req.app.get('models');
  const { jobId } = req.params;
  const { profile } = req;
  if (!profile) return res.status(404).json({ error: 'Job not found' });

  const job = await Job.findOne({
    where: { id: jobId, [Op.or]: [{ paid: false }, { paid: null }] },
    include: [
      {
        model: Contract,
        as: 'contract',
        where: { clientId: profile.id, status: ContractStatus.IN_PROGRESS },
      },
    ],
  });
  if (!job)
    return res.status(404).json({
      error: 'Job already paid, not found, or the Contract for this Profile is not active',
    });

  const { price } = job;
  if (profile.balance < price) {
    return res.status(400).json({ error: 'Insufficient funds' });
  }

  try {
    await sequelize.transaction(async (t) => {
      await Profile.update(
        { balance: sequelize.literal(`balance - ${price}`) },
        { where: { id: job.contract.clientId } },
        { transaction: t },
      );

      await Profile.update(
        { balance: sequelize.literal(`balance + ${price}`) },
        { where: { id: job.contract.contractorId } },
        { transaction: t },
      );

      await Job.update({ paid: true }, { where: { id: jobId } }, { transaction: t });
    });

    res.status(200).json({ message: 'Job paid successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

export default app;
