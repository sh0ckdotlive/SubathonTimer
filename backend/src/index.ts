import express = require('express');
import bodyParser = require('body-parser');
import { Server } from "socket.io";

const io = new Server({

})

const app = express();
const jsonParser = bodyParser.json();

const MESSAGE_ID = 'Twitch-Eventsub-Message-Id'.toLowerCase();
const MESSAGE_TYPE = 'Twitch-Eventsub-Message-Type'.toLowerCase();

const CALLBACK_VERIFICATION = 'webhook_callback_verification';
const NOTIFICATION = 'notification';

app.use(jsonParser);

let handledMessageIds: string[] = [];

let timer = 0;
let timerRunning = false;

app.post('/eventsub', jsonParser, (req, res) => {
    // We've already handled this message, we don't need to do it again.
    if (handledMessageIds.find(id => id === req.headers[MESSAGE_ID])) {
        res.status(200).send();
        return;
    }

    // Respond with the challenge verifying our identity.
    if (req.headers[MESSAGE_TYPE] === CALLBACK_VERIFICATION) {
        res.status(200).send(req.body.challenge);
        return;
    }

    if (req.headers[MESSAGE_TYPE] === NOTIFICATION) {
        // Handle the message.
        switch (req.body.subscription.type) {
            default:
                console.log(`Unknown/unhandled subscription type: ${req.body.subscription.type}`);
                break;
        }

        handledMessageIds.push(<string>req.headers[MESSAGE_ID]);
        res.sendStatus(200);
    }
});

io.on('connection', client => {
    console.log(`New client connected with id ${client.id}.`)
    client.emit('timerInit', timer, timerRunning);

    client.on('stopTimer', () => timerRunning = false)
    client.on('resumeTimer', () => timerRunning = true)
})

io.listen(8081);

app.listen(8080, () => {
    console.log('HTTP server is listening on port 8080');
});