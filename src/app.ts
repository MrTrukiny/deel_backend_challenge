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
    attributes: [['id', 'contractId'], 'clientId', 'contractorId', 'status'],
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

/**
 * @description Deposits money into the balance of a Client, a Client can't deposit more than 25% his total of jobs price to pay (at the deposit moment).
 * @returns a success message or an error
 */
app.post('/api/v1/balances/deposit/:userId', getProfile, async (req, res) => {
  const { Contract, Job, Profile } = req.app.get('models');
  const { userId } = req.params;
  const { profile } = req;

  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  if (profile.id !== Number(userId)) {
    return res.status(403).json({ error: 'You can not deposit for another Profile' });
  }

  const { amount } = req.body;
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Amount is required and must be greater than 0' });
  }

  const { balance } = profile;
  const totalJobsToPay = await Job.sum('price', {
    where: { [Op.or]: [{ paid: false }, { paid: null }] },
    include: [
      {
        model: Contract,
        as: 'contract',
        where: { clientId: profile.id, status: ContractStatus.IN_PROGRESS },
      },
    ],
  });

  const maxDeposit = totalJobsToPay * 1.25;

  if (totalJobsToPay === 0) {
    return res.status(400).json({
      error: 'You can not deposit money because you have no jobs to pay',
    });
  }

  if (balance + amount > maxDeposit) {
    return res.status(400).json({
      error: `You can not deposit more than 25% of your total jobs to pay. Please pay some jobs first. MaxDeposit: ${maxDeposit}, Balance: ${balance}, MaxAmount: ${(
        maxDeposit - balance
      ).toFixed(2)}`,
    });
  }

  try {
    await Profile.update(
      {
        balance: sequelize.literal(`
        CASE WHEN balance IS NULL THEN ${amount} ELSE balance + ${amount} END
      `),
      },
      { where: { id: userId } },
    );

    return res.status(200).json({ message: 'Deposit successful' });
  } catch (error) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

/**
 * @description Returns the profession that earned the most money (sum of jobs paid) for any Contractor that worked in the query time range.
 * @returns a success message or an error
 */
app.get('/api/v1/admin/best-profession', async (req, res) => {
  const { Contract, Job, Profile } = req.app.get('models');
  const { start, end } = req.query;

  if (!start || !end) {
    return res.status(400).json({ error: 'Start and End dates are required' });
  }

  const bestProfession = await Profile.findAll({
    attributes: [
      'profession',
      [sequelize.fn('sum', sequelize.col('contractor.jobs.price')), 'total'],
    ],
    where: {
      id: {
        [Op.in]: sequelize.literal(
          `(SELECT contractorId FROM Contracts WHERE id IN (SELECT contractId FROM Jobs WHERE paid = true AND paymentDate BETWEEN '${start}' AND '${end}'))`,
        ),
      },
    },
    include: [
      {
        model: Contract,
        as: 'contractor',
        where: {
          id: {
            [Op.in]: sequelize.literal(
              `(SELECT contractId FROM Jobs WHERE paid = true AND paymentDate BETWEEN '${start}' AND '${end}')`,
            ),
          },
        },
        include: [
          {
            model: Job,
            as: 'jobs',
            where: { paid: true, paymentDate: { [Op.between]: [start, end] } },
          },
        ],
      },
    ],
    group: ['profession'],
    order: [[sequelize.literal('total'), 'DESC']],
  });

  if (!bestProfession || !bestProfession.length) {
    return res.status(200).json({ message: 'There are no Jobs in this period' });
  }

  return res.status(200).json({ data: { bestProfession: bestProfession[0].profession } });
});

/**
 * @description Returns the Clients that paid the most for jobs in the query time period. limit query parameter should be applied, default limit is 2.
 * @example /api/v1/admin/best-clients?start=2020-01-01&end=2020-12-31&limit=3
 * @returns a success message or an error
 */
app.get('/api/v1/admin/best-clients', async (req, res) => {
  const { Contract, Job, Profile } = req.app.get('models');
  const { start, end, limit } = req.query;

  if (!start || !end) {
    return res.status(400).json({ error: 'Start and End dates are required' });
  }

  const bestClients = await Profile.findAll({
    // There is a bug in sequelize that does not allow to use limit when include is used. This is a workaround for that.
    limit: limit || 2,
    subQuery: false,
    // I found this solution in this issue: https://github.com/sequelize/sequelize/issues/9651#issuecomment-460160022
    attributes: [
      'id',
      'firstName',
      'lastName',
      [sequelize.fn('sum', sequelize.col('client.jobs.price')), 'total'],
    ],
    where: {
      id: {
        [Op.in]: sequelize.literal(
          `(SELECT clientId FROM Contracts WHERE id IN (SELECT contractId FROM Jobs WHERE paid = true AND paymentDate BETWEEN '${start}' AND '${end}'))`,
        ),
      },
    },
    include: [
      {
        model: Contract,
        as: 'client',
        where: {
          id: {
            [Op.in]: sequelize.literal(
              `(SELECT contractId FROM Jobs WHERE paid = true AND paymentDate BETWEEN '${start}' AND '${end}')`,
            ),
          },
        },
        required: true,
        include: [
          {
            model: Job,
            as: 'jobs',
            where: { paid: true, paymentDate: { [Op.between]: [start, end] } },
            required: true,
          },
        ],
      },
    ],
    group: ['firstName', 'lastName'],
    order: [[sequelize.literal('total'), 'DESC']],
  });

  if (!bestClients || !bestClients.length) {
    return res.status(200).json({ message: 'There are no Clients in this period' });
  }

  return res.status(200).json({ data: { bestClients } });
});

export default app;
