// This example uses events to detect when new listings are pending approval or
// are published and prints out information about those listings. The sequence
// ID of the last processed event is stored locally so that the event processing
// can continue from the correct point on next execution.

// This dotenv import is required for the `.env` file to be read
require('dotenv').config();
const fs = require('fs');

const flexIntegrationSdk = require('sharetribe-flex-integration-sdk');



    const integrationSdk = flexIntegrationSdk.createInstance({
    // These two env vars need to be set in the `.env` file.
    clientId: process.env.FLEX_INTEGRATION_CLIENT_ID,
    clientSecret: process.env.FLEX_INTEGRATION_CLIENT_SECRET,

    // Normally you can just skip setting the base URL and just use the
    // default that the `createInstance` uses. We explicitly set it here
    // for local testing and development.
    baseUrl: process.env.FLEX_INTEGRATION_BASE_URL || 'https://flex-integ-api.sharetribe.com',
    });

    // Start polloing from current time on, when there's no stored state
    const startTime = new Date();

    // Polling interval (in ms) when all events have been fetched. Keeping this at 1
    // minute or more is a good idea. In this example we use 10 seconds so that the
    // data is printed out without too much delay.
    const pollIdleWait = 10000;
    // Polling interval (in ms) when a full page of events is received and there may be more
    const pollWait = 250;

    // File to keep state across restarts. Stores the last seen event sequence ID,
    // which allows continuing polling from the correct place
    const stateFile = "./notify-new-listings.state";

    const queryEvents = (args) => {
        var filter = {eventTypes: "user/updated"};
    return integrationSdk.events.query(
        {...args, ...filter}
    );
    };

    const saveLastEventSequenceId = (sequenceId) => {
    try {
        fs.writeFileSync(stateFile, sequenceId.toString())
    } catch (err) {
        throw err;
    }
    };

    /**
     * @param {string} listingId
     * @param {number} likeAddition – A value representing a like or a dislike that is either added to or subtracted from currentLikes
     */
    const updateListing = (listingId, likeAddition) => {
        return integrationSdk.listings
        .query({
            ids: listingId,
        })
        .then(listings => {
            const listing = listings.data.data[0];
            const currentLikes = listing.attributes.publicData.likes || 0;
            const updatedLikes = currentLikes + likeAddition;
            return integrationSdk.listings.update(
            {
                id: listingId,
                publicData: {
                likes: updatedLikes,
                },
            },
            { expand: true }
            );
        });
    };

    const loadLastEventSequenceId = () => {
    try {
        const data = fs.readFileSync(stateFile);
        return parseInt(data, 10);
    } catch (err) {
        return null;
    }
    };


    const pollLoop = (sequenceId) => {
    var params = sequenceId ? {startAfterSequenceId: sequenceId} : {createdAtStart: startTime};
    queryEvents(params)
        .then(res => {
        const events = res.data.data;
        const lastEvent = events[events.length - 1];
        const fullPage = events.length === res.data.meta.perPage;
        const delay = fullPage? pollWait : pollIdleWait;
        if(events.length > 0) {
            console.log(events)
            console.log("event detected")
        }
        else { console.log("poll loop")}
        
        if (lastEvent) saveLastEventSequenceId(lastEvent.attributes.sequenceId);

        setTimeout(() => {pollLoop(lastSequenceId);}, delay);
        });
    };

    const lastSequenceId = loadLastEventSequenceId();

    console.log("Press <CTRL>+C to quit.");
    if (lastSequenceId) {
    console.log(`Resuming event polling from last seen event with sequence ID ${lastSequenceId}`);
    } else {
    console.log("No state found or failed to load state.");
    console.log("Starting event polling from current time.");
    }

    pollLoop(lastSequenceId);
