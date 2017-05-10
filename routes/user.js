const express = require("express");
const router = express.Router();
const ensureLogin = require("connect-ensure-login");
const User = require("../models/user");
const bcrypt = require("bcrypt");
const Coin = require("../models/coin");
const PortfolioHistories = require("../models/portfolio_history");
const async = require("async");
const bcryptSalt = 10;
const calculatePortfolio = require("../helpers/calculate-portfolio");

router.post("/user/portfolio", ensureLogin.ensureLoggedIn("/"), (req, res) => {
  if (req.body.coinId) {
    User.findOneAndUpdate({ "_id": req.user.id }, {
      $push: {
        "portfolio.coins": {
          id: req.body.coinId,
          exchange: "wallet",
          balance: req.body.amount
        }
      }
    }, err => {
      if (err) console.log(err)
      calculatePortfolio(req.user.id, (total) => {
        console.log('total: ', total);

        User.findOneAndUpdate({ "_id": req.user.id }, { "portfolio.total": total }, (err) => {
          res.redirect("/user/portfolio");
        });
      });
    });
  } else {
    res.redirect("/user/portfolio");
  }
});

router.post("/user/portfolio/:coinId", ensureLogin.ensureLoggedIn("/"), (req, res) => {
  User.findOneAndUpdate({ "_id": req.user.id, "portfolio.coins.exchange": "wallet", "portfolio.coins.id": req.params.coinId }, { "$set": { "portfolio.coins.$.balance": req.body.balance } }, (err) => {
    if (err) console.log(err)
    calculatePortfolio(req.user.id, (total) => {
      console.log('total: ', total);

      User.findOneAndUpdate({ "_id": req.user.id }, { "portfolio.total": total }, (err) => {
        res.redirect("/user/portfolio");
      });
    });

  })
});

router.get("/user/portfolio/:coinId/delete", ensureLogin.ensureLoggedIn("/"), (req, res) => {
  User.findOneAndUpdate({ "_id": req.user.id }, { $pull: { "portfolio.coins": { exchange: "wallet", id: req.params.coinId } } }, err => {
    if (err) console.log(err)
    calculatePortfolio(req.user.id, (total) => {
      console.log('total: ', total);

      User.findOneAndUpdate({ "_id": req.user.id }, { "portfolio.total": total }, (err) => {
        res.redirect("/user/portfolio");
      });
    });
  })
});

router.get("/user/portfolio", ensureLogin.ensureLoggedIn("/"), (req, res) => {
  if (req.user.portfolio) {
    Coin.find({}, function (err, coins) {

      let pieTotalLabels = [];
      let pieTotalData = [];

      let piePoloniexLabels = [];
      let piePoloniexData = [];

      let pieBittrexLabels = [];
      let pieBittrexData = [];

      let pieWalletLabels = [];
      let pieWalletData = [];

      let allCoins = [];

      async.each(req.user.portfolio.coins, (coin, callback) => {

        Coin.findOne({ "id": coin.id }, (err, cmcCoin) => {
          if (cmcCoin) {
            let ind = null;
            // if ((ind = allCoins.findIndex(el => el.id === coin.id)) !== -1) {
            //   allCoins[ind].balance += coin.balance;
            //   allCoins[ind].value += Math.round(coin.balance * cmcCoin.price_usd * 100) / 100;
            // } else {
            coin.value = Math.round(coin.balance * cmcCoin.price_usd * 100) / 100;
            coin.price = cmcCoin.price_usd;
            allCoins.push(coin);
            // }
            pushData(coin, cmcCoin, pieTotalLabels, pieTotalData)
            if (coin.exchange === "poloniex") {
              pushData(coin, cmcCoin, piePoloniexLabels, piePoloniexData);
            }
            if (coin.exchange === "bittrex") {
              pushData(coin, cmcCoin, pieBittrexLabels, pieBittrexData);
            }
            if (coin.exchange === "wallet") {
              pushData(coin, cmcCoin, pieWalletLabels, pieWalletData);
            }
          }
          callback();
        });
      }, err => {


        allCoins.sort((a, b) => b.value - a.value);
        allCoins = allCoins.map(coin => { coin.value = Math.round(100 * coin.value) / 100; return coin; });
        res.render('user/portfolio', { coins, allCoins, pieTotalData, pieTotalLabels, piePoloniexData, piePoloniexLabels, pieBittrexData, pieBittrexLabels, pieWalletData, pieWalletLabels });
      })


    });

  } else {
    res.render('user/portfolio');
  }

  function pushData(coin, cmcCoin, labels, data) {
    let ind = null;
    if ((ind = labels.findIndex(el => el === coin.id)) !== -1) {
      data[ind] += Math.round(coin.balance * cmcCoin.price_usd * 100) / 100;
    } else {
      labels.push(coin.id);
      data.push(Math.round(coin.balance * cmcCoin.price_usd * 100) / 100);
    }
  }

});




router.get("/user/dashboard", ensureLogin.ensureLoggedIn("/"), (req, res) => {
  Coin.find({}, function (err, coins) {
    User.findOne({ "_id": req.user.id }, "coins", function (err, userCoins) {
      res.render('user/dashboard', {
        coins,
        userCoins: userCoins.coins
      });
    });
  });
});

router.post("/send_save", ensureLogin.ensureLoggedIn("/"), (req, res) => {
  User.findOneAndUpdate({ "_id": req.user.id }, { $addToSet: { "coins": req.body.name } }, (err, user) => {
    if (err) {
      res.status(500).json({ message: err });
    } else {
      res.status(200).json({ message: "ok" });
    }
  });
});

router.get("/user/edit", ensureLogin.ensureLoggedIn("/"), (req, res) => {

  res.render('user/edit');

});



router.get("/user/map", ensureLogin.ensureLoggedIn("/"), (req, res) => {
    User.findOne({ "_id": req.user.id }, "coins", function (err, coins) {
      res.render('user/map', {
        coins
      });
    });
});

router.get("/user/email", ensureLogin.ensureLoggedIn("/"), (req, res) => {
  res.render('user/email');
});

router.get("/user/notifications", ensureLogin.ensureLoggedIn("/"), (req, res) => {
  res.render('user/notifications');
});

router.get("/user/connect", ensureLogin.ensureLoggedIn("/"), (req, res) => {
  User.find({}, function (err, users) {
    users,
      res.render('user/addFriends');
  });
});

router.get("/user/logout", ensureLogin.ensureLoggedIn("/"), (req, res) => {
  req.logout();
  res.redirect('/');
});

router.post("/user/:userId", ensureLogin.ensureLoggedIn("/"), (req, res, next) => {
  const password = req.body.password,
    passwordRepeat = req.body.passwordRepeat;

  const data = {
    name: req.body.name,
    email: req.body.email,
    company: req.body.company,
    website: req.body.website,
    bio: req.body.bio,
    address: req.body.city,
    location: { type: 'Point', coordinates: [req.body.lng ? req.body.lng : 0, req.body.lat ? req.body.lat : 0], default: [0, 0] },
    poloniex: { apikey: req.body.poloniex_apikey, apisecret: req.body.poloniex_apisecret },
    bittrex: { apikey: req.body.bittrex_apikey, apisecret: req.body.bittrex_apisecret }
  }

  if (password) {
    if (password !== passwordRepeat) {
      res.render("/user/edit", { message: "Passwords don't match" });
      return;
    } else {
      const salt = bcrypt.genSaltSync(bcryptSalt);
      const hashPass = bcrypt.hashSync(password, salt);
      data.password = hashPass;
    }
  }

  User.findOneAndUpdate({ "_id": req.params.userId }, data, (err, user) => {
    if (err) { next(err); return; }
    res.redirect("/user/dashboard");
  })
});

router.get("/user/clan_join", ensureLogin.ensureLoggedIn("/"), (req, res) => {
  res.render('user/clan_join');
});

router.get("/user/:userId", ensureLogin.ensureLoggedIn("/"), (req, res) => {
  User.findOne({"_id":req.params.userId}, (err,showUser)=>{
    console.log('showUser: ', showUser);
    res.render("user/show", {showUser});
  })
});


module.exports = router;