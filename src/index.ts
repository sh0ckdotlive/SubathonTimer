import express = require('express');
import bodyParser = require('body-parser');

const app = express();
const jsonParser = bodyParser.json();

app.use(jsonParser);

app.post('/eventsub', jsonParser, (req, res) => {
    console.log(req.body);
    res.sendStatus(200);
});

app.listen(8080, () => {
    console.log('Server is listening on port 8080');
});