import app from './app';
const PORT = 3001;

init();

async function init() {
  try {
    app.listen(PORT, () => {
      console.log(`Express App Listening on Port ${PORT}`);
    });
  } catch (error) {
    console.log(error);
    console.error(`An error occurred: ${JSON.stringify(error)}`);
    process.exit(1);
  }
}
