### Version 0.2.0

This version includes possible breaking changes. Read the log carefully.

8. Create a new /api/v1/admin/best-profession?start=<date>&end=<date> endpoint that returns the profession that earned the most money (sum of jobs paid) for any Contractor that worked in the query time range.
7. Create a new /api/v1/balances/deposit/:userId endpoint to deposit money into the balance of a Client (userId). A Client can't deposit more than 25% his total of jobs price to pay (at the deposit moment).
6. Create a new /api/v1/jobs/:jobId/pay endpoint to POST a payment from a Client to a Contractor. A Client can only pay if his balance >= the amount to pay, and if the Contract is active. The amount should be moved from the Client's balance to the Contractor balance.
5. Create a new /api/v1/jobs/unpaid endpoint to GET All the unpaid jobs for a user (**_either_** a client or contractor), for **_active contracts only_**.
4. Create a new /api/v1/contracts endpoint to GET All the contracts only if they belong to the profile calling. Create a new ContractStatus enum to handle this kind of word (properties) and better avoid typos.
3. Fix models and database configuration that was causing the 'seed' script (sequelize) to make wrong table relationships. Fix the /api/v1/contracts/:contractId endpoint to GET the contract only if it belongs to the profile calling.
2. Migrate code from JavaScript to TypeScript. Separate models into single files and move the database connection to the config folder. Add a custom type to Express Response and Request interfaces to be allowed to use req.profile property. Remove the body-parser library to use the express.json() method that Express has included since version 4.
1. Install required dependencies and create config files to run the project using TypeScript, ESLint, Prettier, and Nodemon. Modify package.json to include some new scripts. Add a script to run in debugging mode. Add CHANGELOG file.
