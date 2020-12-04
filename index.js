var fs = require("fs");
var readline = require("readline");
var { google } = require("googleapis");
const { auth } = require("google-auth-library");
var OAuth2 = google.auth.OAuth2;

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/youtube-nodejs-quickstart.json
var SCOPES = ["https://www.googleapis.com/auth/youtube"];
var TOKEN_DIR =
  (process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE) +
  "/.credentials/";
var TOKEN_FILE = "youtube-nodejs.json"; //"youtube-nodejs-anand.json";
var TOKEN_PATH = TOKEN_DIR + TOKEN_FILE;

var CREDS_FILE = "client_secret.json"; //"client_secret_anand.json";

const USER_DATA = {
  currentSubscriptions: {},
  newSubscriptionsCount: 0,
  currentSubscriptionsCount: 0,
  alreadyInAccountCount: 0,
  subscriptionsCompletedCount: 0,
};

var subscriptions = JSON.parse(fs.readFileSync("./subscriptions.json"));

USER_DATA.newSubscriptionsCount = subscriptions.length;

//console.log(subscriptions.length);

// Load client secrets from a local file.
fs.readFile(CREDS_FILE, function processClientSecrets(err, content) {
  if (err) {
    console.log("Error loading client secret file: " + err);
    return;
  }
  // Authorize a client with the loaded credentials, then call the YouTube API.
  authorize(JSON.parse(content), importSubscriptions);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  var clientSecret = credentials.web.client_secret;
  var clientId = credentials.web.client_id;
  var redirectUrl = credentials.web.redirect_uris[0];
  var oauth2Client = new OAuth2(clientId, clientSecret, redirectUrl);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, function (err, token) {
    if (err) {
      getNewToken(oauth2Client, callback);
    } else {
      oauth2Client.credentials = JSON.parse(token);
      callback(oauth2Client);
    }
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback) {
  var authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });
  console.log("Authorize this app by visiting this url: ", authUrl);
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question("Enter the code from that page here: ", function (code) {
    rl.close();
    oauth2Client.getToken(code, function (err, token) {
      if (err) {
        console.log("Error while trying to retrieve access token", err);
        return;
      }
      oauth2Client.credentials = token;
      storeToken(token);
      callback(oauth2Client);
    });
  });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
  try {
    fs.mkdirSync(TOKEN_DIR);
  } catch (err) {
    if (err.code != "EEXIST") {
      throw err;
    }
  }
  fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
    if (err) throw err;
    console.log("Token stored to " + TOKEN_PATH);
  });
}

/**
 * Lists the names and IDs of up to 10 files.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function getChannel(auth) {
  var service = google.youtube("v3");
  service.channels.list(
    {
      auth: auth,
      part: "snippet,contentDetails,statistics",
      forUsername: "arockiaanandraj",
    },
    function (err, response) {
      if (err) {
        console.log("The API returned an error: " + err);
        return;
      }
      var channels = response.data.items;
      if (channels.length == 0) {
        console.log("No channel found.");
      } else {
        console.log(
          "This channel's ID is %s. Its title is '%s', and " +
            "it has %s views.",
          channels[0].id,
          channels[0].snippet.title,
          channels[0].statistics.viewCount
        );
      }
    }
  );
}

/**
 * Imports subscriptions
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function importSubscriptions(auth) {
  await getSubscriptions(auth);

  //console.log(USER_DATA.currentSubscriptions);

  await subscriptions.forEach(async (item) => {
    if (
      !(item.snippet.resourceId.channelId in USER_DATA.currentSubscriptions)
    ) {
      console.log(`Subscribing to ${item.snippet.title}`);
      await insertSubscription(auth, item);
      printStats();
      return;
    }
    console.log(`Skipping ${item.snippet.title}`);
    USER_DATA.alreadyInAccountCount = USER_DATA.alreadyInAccountCount + 1;
    printStats();
  });
  
}
const printStats = () => {
    console.log(
        `New Subscriptions requested = ${USER_DATA.newSubscriptionsCount}`
      );
      console.log(
        `Subscriptions completed = ${USER_DATA.subscriptionsCompletedCount}`
      );
      console.log(`Subscriptions skipped = ${USER_DATA.alreadyInAccountCount}`);
      console.log(
        "Subscriptions yet to be done =" +
          (USER_DATA.newSubscriptionsCount -
            (USER_DATA.alreadyInAccountCount +
              USER_DATA.subscriptionsCompletedCount))
      );
}
const getSubscriptions = async (auth, pageToken = null) => {
  console.log(`Fetching subscriptions...`);
  try {
    const userData = USER_DATA.currentSubscriptions;
    var service = google.youtube("v3");
    const response = await service.subscriptions.list({
      auth: auth,
      part: "snippet",
      mine: true,
      maxResults: 50,
      pageToken: pageToken ? pageToken : undefined,
    });
    // console.log(response);
    response.data.items.forEach((element) => {
      userData[element.snippet.resourceId.channelId] = element.snippet.title;
    });
    let nextPage = response.data.nextPageToken;
    if (nextPage)
      await getSubscriptions(auth, (pageToken = response.data.nextPageToken));
    else {
      console.log("Subscriptions fetched successfully");
    }
  } catch (err) {
    console.log(`${err}`);
    //throw new Error(err.result.error.errors[0].reason);
  }
};

const insertSubscription = async (auth, item) => {
  var service = google.youtube("v3");
  //console.log(`Subscribing to '${item.snippet.title}'`);
  service.subscriptions.insert(
    {
      auth: auth,
      part: ["snippet"],
      resource: {
        snippet: {
          resourceId: {
            kind: "youtube#channel",
            channelId: item.snippet.resourceId.channelId,
          },
        },
      },
    },
    function (err, response) {
      if (err) {
        if (err.errors.some((e) => e.reason === "subscriptionDuplicate")) {
          console.log(`'${item.snippet.title}' is already subscribed`);

          return;
        }
        console.log(
          `The API returned an error while subscribing to '${item.snippet.title}': ${err}`
        );
        return;
      }
      USER_DATA.subscriptionsCompletedCount =
        USER_DATA.subscriptionsCompletedCount + 1;
      console.log(`'${item.snippet.title}' is subscribed`);
    }
  );
};
