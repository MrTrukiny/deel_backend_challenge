import express from 'express';
import { Op } from 'sequelize';
import { sequelize } from './models';
import { getProfile } from './middleware/getProfile.middleware';
const app = express();

app.use(express.json());
app.set('sequelize', sequelize);
app.set('models', sequelize.models);

/**
 * FIX ME!
 * @returns contract by id
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
  res.status(200).json(contract);
});

export default app;
