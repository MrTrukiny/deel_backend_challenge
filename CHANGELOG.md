### Version 0.2.0

This version includes possible breaking changes. Read the log carefully.

2. Migrate code from JavaScript to TypeScript. Separate models into single files and move the database connection to the config folder. Add a custom type to Express Response and Request interfaces to be allowed to use req.profile property. Remove the body-parser library to use the express.json() method that Express has included since version 4.
1. Install required dependencies and create config files to run the project using TypeScript, ESLint, Prettier, and Nodemon. Modify package.json to include some new scripts. Add a script to run in debugging mode. Add CHANGELOG file.
