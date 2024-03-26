const express = require("express");
const app = express();
app.use(express.json());

const bcrypt = require("bcrypt");

const jwt = require("jsonwebtoken");

const path = require("path");
const dbPath = path.join(__dirname, "./twitterClone.db");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
let db = null;

const connectDbInitializeServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Connected to db and server started");
    });
  } catch (e) {
    console.log(e.message);
  }
};

connectDbInitializeServer();

// Global Middleware to get username based on jwtToken
const getUserNameWithJwtToken = (req, res, next) => {
  let anyError = false,
    data;
  const authorizationLine = req.headers.authorization;
  const arr = authorizationLine.split(" ");
  const providedToken = arr[1];
  // console.log(providedToken);
  jwt.verify(providedToken, "JWT_TOKEN", async (error, payload) => {
    // console.log("went into verify");
    if (error) {
      // console.log("error occured in verify");
      anyError = true;
      data = "Invalid Token";
    } else {
      // console.log("no error occured");
      // console.log(payload);
      data = payload.userId;
      // console.log(data);
    }
  });
  if (anyError) {
    res.send(data);
  } else {
    req.data = data;
    next();
  }
};

// --->>> 1 - Registering API -------->>>>

const handleRegisteringNewUser = async (req, res, next) => {
  let msg, status;
  try {
    console.log(req.body);
    const { username, password, name, gender } = req.body;
    let gettingExistingUserUsingUsernameQuery = `SELECT * FROM USER WHERE username = '${username}'`;
    const existingUser = await db.get(gettingExistingUserUsingUsernameQuery);
    if (existingUser !== undefined) {
      msg = "User already exists";
      status = 400;
    } else {
      if (password.length < 6) {
        // res.status(400).send("Password is too short");
        msg = "Password is too short";
        status = 400;
      } else {
        const hashedPassword = await bcrypt.hash(password, 10);

        const insertingNewUserQuery = `INSERT INTO USER(name , username , password , gender)
        VALUES('${name}' , '${username}' , '${hashedPassword}' , '${gender}') `;

        const insertingNewUserPromise = db.run(insertingNewUserQuery);
        console.log(insertingNewUserPromise);
        msg = "User created successfully";
        status = 200;
      }
    }
    req.status = status;
    req.msg = msg;

    next();
  } catch (e) {
    console.log(e.message);
  }
};

app.post("/register", handleRegisteringNewUser, async (req, res) => {
  const { status, msg } = req;
  res.status(status).send(msg);
});

//--------------->>>>> completed Register API <<<<<<<<<<-----------

// <<<<------- API-2 Login    --------->>>>>>>>>

const handleLogin = async (req, res, next) => {
  const { username, password } = req.body;
  let msg, status;
  try {
    const existedUserQuery = `SELECT * FROM USER WHERE username = '${username}' `;
    const userDetailsWithGivenUsername = await db.get(existedUserQuery);
    console.log(userDetailsWithGivenUsername);
    if (userDetailsWithGivenUsername === undefined) {
      msg = "Invalid user";
      status = 400;
    } else {
      console.log(userDetailsWithGivenUsername);
      const hashedPassword = userDetailsWithGivenUsername.password;
      const isPasswordCorrect = await bcrypt.compare(password, hashedPassword);
      if (isPasswordCorrect) {
        const payload = {
          userId: userDetailsWithGivenUsername.user_id,
          username,
        };
        const tokenGenerated = await jwt.sign(payload, "JWT_TOKEN");
        msg = JSON.stringify({ jwtToken: tokenGenerated });
        status = 200;
      } else {
        msg = "Invalid password";
        status = 400;
      }
    }
  } catch (e) {
    console.log(e.message);
  }
  req.status = status;
  req.msg = msg;
  next();
};

app.post("/login", handleLogin, async (req, res) => {
  const { msg, status } = req;
  res.status(status).send(msg);
});

// ------->>>>>>>>  Completed Api-2 Login API  <<<<<<<<-------------

// -------->>>>>>>> API-3  Getting Latest Tweets api  <<<<<<--------

const modifyingKeysOfResponseOfApi3 = (listOfTweets) => {
  const res = listOfTweets.map((eachObj) => ({
    username: eachObj.username,
    tweet: eachObj.tweet,
    dateTime: eachObj.date_time,
  }));

  return res;
};

const getLatestTweetsOfUserWhomFollows = async (req, res, next) => {
  const { data } = req;
  const gettingLatestTweetsUsingUserId = `SELECT DISTINCT t2.tweet ,  USER.username , t2.date_time  FROM (SELECT * FROM (SELECT * FROM FOLLOWER WHERE follower_user_id = ${data}) as t1 INNER JOIN TWEET ON t1.following_user_id = TWEET.user_id) AS t2 INNER JOIN USER ON t2.user_id = USER.user_id ORDER BY t2.date_time DESC;`;
  const gettingLatestTweetsResponse = await db.all(
    gettingLatestTweetsUsingUserId
  );
  // console.log(gettingLatestTweetsResponse);

  const modifiedKeysOfResponse = modifyingKeysOfResponseOfApi3(
    gettingLatestTweetsResponse
  );
  req.latestTweetsData = modifiedKeysOfResponse;
  next();
};

app.get(
  "/user/tweets/feed/",
  getUserNameWithJwtToken,
  getLatestTweetsOfUserWhomFollows,
  (req, res) => {
    const { latestTweetsData } = req;
    console.log(latestTweetsData);
    res.status(200).json(latestTweetsData);
  }
);

// ---->>>> API-3 Completed   <<<<---------

// ----------->>>>>>>>  API-4  <<<<<-------------- starting

/*const modifyKeysOfListOfObjOfApi4 = (listOfUsers)=> {
    const result = listOfUsers.map(())
} */

const getFollowingListOfPeople = async (req, res, next) => {
  const { data } = req;
  const gettingPeopleWhomUserFollowsQuery = `SELECT USER.name FROM (SELECT * FROM USER INNER JOIN FOLLOWER ON USER.user_id = FOLLOWER.follower_user_id WHERE USER.user_id = ${data}) AS t1 INNER JOIN USER WHERE t1.following_user_id = USER.user_id;`;
  console.log(gettingPeopleWhomUserFollowsQuery);
  try {
    const listOfUsersWhomUserFollows = await db.all(
      gettingPeopleWhomUserFollowsQuery
    );
    console.log(listOfUsersWhomUserFollows);
    req.listOfUsers = listOfUsersWhomUserFollows;
  } catch (e) {
    console.log(e.message);
  }
  next();
};

app.get(
  "/user/following/",
  getUserNameWithJwtToken,
  getFollowingListOfPeople,
  (req, res) => {
    const { listOfUsers } = req;
    res.status(200).json(listOfUsers);
  }
);

// ----->>> API-4 <<<<<--------- Completed

// ------>>> API-5 <<<<------------    Starting

const modifyingKeysOfResponseListOfApi5 = (listOfFollowers) => {
  const result = listOfFollowers.map((eachObj) => ({
    name: eachObj.name,
  }));

  return result;
};

const getFollowersOfUser = async (req, res, next) => {
  const { data } = req;
  const gettingFollowersOfUserQuery = `SELECT USER.name FROM (SELECT * FROM FOLLOWER WHERE following_user_id = ${data}) as t1 INNER JOIN USER ON t1.follower_user_id = USER.user_id;`;
  const followersListResponse = await db.all(gettingFollowersOfUserQuery);
  console.log(followersListResponse);
  const modifiedKeysOfResponse = modifyingKeysOfResponseListOfApi5(
    followersListResponse
  );
  req.listOfFollowers = modifiedKeysOfResponse;
  next();
};

app.get(
  "/user/followers/",
  getUserNameWithJwtToken,
  getFollowersOfUser,
  (req, res) => {
    const { listOfFollowers } = req;
    res.status(200).json(listOfFollowers);
  }
);
// -------->>>>> API-5 <<<<<<------------ Completed

const returnTweetIdsInList = (listOfTweets) => {
  let res = [];
  listOfTweets.forEach((eachObj) => {
    res.push(eachObj.tweet_id);
  });
  return res;
};

const getDataRelatedToTweetId = async (req, res, next) => {
  const { data } = req;
  const { tweetId } = req.params;
  // console.log(typeof tweetId);
  const listOfTweetIdsFromResponse = await db.all(
    `SELECT t2.tweet_id as tweet_id from  (SELECT * FROM (select * from FOLLOWER where follower_user_id = ${data}) AS t1 INNER JOIN TWEET ON t1.following_user_id = TWEET.user_id) AS t2;`
  );
  console.log(listOfTweetIdsFromResponse);
  let isPresent = true;
  const tweetIdsList = returnTweetIdsInList(listOfTweetIdsFromResponse);
  console.log(tweetIdsList);
  if (!tweetIdsList.includes(parseInt(tweetId))) {
    isPresent = false;
    // res.status(401).send("Invalid Request");
  }
  // console.log(listOfFollowingUserIds);
  if (!isPresent) {
    console.log("Not present");
    res.send("No id");
  } else {
    const tweetDetails = await db.get(
      `SELECT tweet , date_time from TWEET where tweet_id = ${data}`
    );
    const replyCount = await db.get(
      `SELECT count(*) as reply_count from REPLY WHERE tweet_id = ${data} `
    );
    const likesCount = await db.get(
      `SELECT count(*) as likes_count from LIKE where tweet_id = ${data} `
    );
    console.log(tweetDetails);
    console.log(replyCount);
    console.log(likesCount);
    req.tweetDetailsRequested = {
      tweet: tweetDetails.tweet,
      likes: likesCount.likes_count,
      replies: replyCount.reply_count,
      dateTime: tweetDetails.date_time,
    };
    next();
  }
};

app.get(
  "/tweets/:tweetId/",
  getUserNameWithJwtToken,
  getDataRelatedToTweetId,
  (req, res) => {
    const { tweetDetailsRequested } = req;
    console.log(tweetDetailsRequested);
    res.status(200).json(tweetDetailsRequested);
  }
);
// ----->>>>> API-6 <<<<<<---------    Completed

// <<<<<<<<<------------- API-7 ---->>>>   Started

// const returnTweetIdsInList = (listOfTweets) => {
//   let res = [];
//   listOfTweets.forEach((eachObj) => {
//     res.push(eachObj.tweet_id);
//   });
//   return res;
// };

const getLikesOfRequestedTweet = async (req, res, next) => {
  console.log("*******");
  const { data } = req;
  const { tweetId } = req.params;
  const getListTweetsOfUserWhomFollowing = await db.all(
    `SELECT t2.tweet_id as tweet_id from  (SELECT * FROM (select * from FOLLOWER where follower_user_id = ${data}) AS t1 INNER JOIN TWEET ON t1.following_user_id = TWEET.user_id) AS t2;`
  );
  console.log(getListTweetsOfUserWhomFollowing);
  let isPresent = true;
  const tweetIdsList = returnTweetIdsInList(getListTweetsOfUserWhomFollowing);
  console.log(tweetIdsList);
  if (!tweetIdsList.includes(parseInt(tweetId))) {
    isPresent = false;
    // res.status(401).send("Invalid Request");
  }
  // console.log(listOfFollowingUserIds);
  if (!isPresent) {
    console.log("Not present");
    console.log("went to not present");
    res.send("No id");
  } else {
    // get likes of tweet_id requested by user
    const listOfUsersWhoLikedRequestedTweet = await db.all(
      `select USER.username from (SELECT * FROM LIKE WHERE tweet_id = ${tweetId}) as t1 INNER JOIN USER ON t1.user_id = USER.user_id;`
    );
    console.log(listOfUsersWhoLikedRequestedTweet);
    req.listOfUsersLikedTweetRequestedByUser = listOfUsersWhoLikedRequestedTweet;
    next();
  }
};

app.get(
  "/tweets/:tweetId/likes/",
  getUserNameWithJwtToken,
  getLikesOfRequestedTweet,
  (req, res) => {
    const { listOfUsersLikedTweetRequestedByUser } = req;
    res.status(200).json(listOfUsersLikedTweetRequestedByUser);
  }
);

//-------->>>>> API-7<<<<<<------   Completed

// <<<<<<---------   API-8 ----------   Starting -------->>>>>>>

const getRepliesOfTweetRequestedByUser = async (req, res, next) => {
  console.log("*******");
  const { data } = req;
  const { tweetId } = req.params;
  const getListTweetsOfUserWhomFollowing = await db.all(
    `SELECT t2.tweet_id as tweet_id from  (SELECT * FROM (select * from FOLLOWER where follower_user_id = ${data}) AS t1 INNER JOIN TWEET ON t1.following_user_id = TWEET.user_id) AS t2;`
  );
  console.log(getListTweetsOfUserWhomFollowing);
  let isPresent = true;
  const tweetIdsList = returnTweetIdsInList(getListTweetsOfUserWhomFollowing);
  console.log(tweetIdsList);
  if (!tweetIdsList.includes(parseInt(tweetId))) {
    isPresent = false;
    // res.status(401).send("Invalid Request");
    res.status(401).send("Invalid Tweet id");
  }
  // console.log(listOfFollowingUserIds);
  else {
    const getReplyAndNameForRequestedTweet = await db.all(
      `SELECT USER.name as name , t1.reply as reply from (select *  from REPLY where tweet_id = ${tweetId}) as t1 INNER JOIN USER ON t1.user_id = USER.user_id;`
    );
    console.log(getReplyAndNameForRequestedTweet);
    req.getReplyAndNameForRequestedTweet = getReplyAndNameForRequestedTweet;
    next();
  }
};

app.get(
  "/tweets/:tweetId/replies/",
  getUserNameWithJwtToken,
  getRepliesOfTweetRequestedByUser,
  (req, res) => {
    const { getReplyAndNameForRequestedTweet } = req;
    res.status(200).json({ replies: getReplyAndNameForRequestedTweet });
  }
);
//-------->>>>>> API-8  <<<<<<----------    Completed

//<<<<<<<--------   API-9  ------>>>>>>>>>   Starting

const getTweetsDoneByUser = async (req, res, next) => {
  const { data } = req;
  const query = `SELECT t5.tweet AS tweet, t6.likes AS likes, t5.replies AS replies, t5.dateTime AS dateTime 
                   FROM (SELECT t1.tweet_id AS tweet_id, t1.tweet AS tweet, t1.date_time AS dateTime, COUNT(REPLY.reply_id) AS replies 
                         FROM (SELECT * FROM TWEET WHERE user_id = ${data}) AS t1 
                         INNER JOIN REPLY ON t1.tweet_id = REPLY.tweet_id 
                         GROUP BY t1.tweet_id) AS t5 
                   INNER JOIN (SELECT t1.tweet_id AS tweet_id, COUNT(LIKE.like_id) AS likes 
                               FROM (SELECT * FROM TWEET WHERE user_id = ${data}) AS t1 
                               INNER JOIN LIKE ON t1.tweet_id = LIKE.tweet_id 
                               GROUP BY t1.tweet_id) AS t6 
                   ON t5.tweet_id = t6.tweet_id;`;
  const infoOfEachTweetDoneByUser = await db.all(query);
  console.log(infoOfEachTweetDoneByUser);
  req.infoOfEachTweetDoneByUser = infoOfEachTweetDoneByUser;
  // Execute the query and handle the result
};
app.get(
  "/user/tweets/",
  getUserNameWithJwtToken,
  getTweetsDoneByUser,
  (req, res) => {
    const { infoOfEachTweetDoneByUser } = req;
    res.status(200).json(infoOfEachTweetDoneByUser);
  }
);

// ------->>>>> API-9  <<<<<------------    Completed
