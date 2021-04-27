require('dotenv').config();
const express = require('express');
const app = express();
var ejs = require('ejs');
app.engine('.ejs', ejs.__express);
app.set('views', __dirname + '/views/');
app.use('/assets', express.static('assets'));
const bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: true }));
const request = require('request');
const cheerio = require("cheerio");
var querystring = require('querystring');
const session = require('express-session');
const domain = process.env.DOMAIN;

app.use(session({
    secret: 'deprem-acil-yardim',
    resave: false,
    saveUninitialized: true
  })
);

const admin = require('firebase-admin');
const serviceAccounts = require('./firebase-config.json');
admin.initializeApp({
	credential : admin.credential.cert(serviceAccounts)
});
const db = admin.firestore();

app.get("/depremler-afad", function (req, res) {
    var form = {
        m: "1",
        utc: "0",
        lastDay: "7",
    };
    var formData = querystring.stringify(form);
    var contentLength = formData.length;
    request(
        {
            headers: {
                "Content-Length": contentLength,
                "Content-Type": "application/x-www-form-urlencoded",
                headerToCache: "m_1utc0_lastDay7",
            },
            uri: "https://deprem.afad.gov.tr/latestCatalogsList",
            body: formData,
            method: "POST",
        },
        async function (error, response, body) {
            if (!error && response.statusCode == 200) {
                var myEarthquakes = [];
                var vEq = await getvirtualEarthquake();
                if (typeof vEq != 'undefined' && Object.keys(vEq).length !== 0) {
                    myEarthquakes.push({
                        buyukluk: vEq.magnitude,
                        enlem: vEq.latitude,
                        boylam: vEq.longitude,
                        tarih: vEq.date,
                        saat: vEq.time,
                        zaman: vEq.dateTime,
                        sehir: vEq.city,
                        ilce: vEq.district,
                        yer: vEq.city + " " + vEq.district,
                        derinlik: vEq.depth,
                    });            
                }
                var earthquakes = JSON.parse(response.body);
                for (const earthquake of earthquakes) {
                    var city = earthquake.city == "-" ? earthquake.other.replace(/.*\(|\).*/g, "") : earthquake.city;
                    var location = earthquake.district == "-" ? city : city + " (" + earthquake.district + ")";
                    myEarthquakes.push({
                        buyukluk: earthquake.m,
                        enlem: earthquake.lat,
                        boylam: earthquake.lon,
                        tarih: earthquake.time.split(" ")[0],
                        saat: earthquake.time.split(" ")[1],
                        zaman: earthquake.time,
                        sehir: city,
                        ilce: earthquake.district,
                        yer: location,
                        derinlik: earthquake.depth,
                    });
                }
                if (req.query.min != null) {
                    myEarthquakes = myEarthquakes.filter(x => parseFloat(x.buyukluk) >= parseFloat(req.query.min));
                }
                if (req.query.max != null) {
                    myEarthquakes = myEarthquakes.filter(x => parseFloat(x.buyukluk) <= parseFloat(req.query.max));
                }
                if (req.query.tarih != null) {
                    myEarthquakes = myEarthquakes.filter(x => x.tarih == req.query.tarih);
                }
                res.setHeader("Content-Type", "application/json");
                res.send(JSON.stringify(myEarthquakes));
            } else {
                res.send("Hata");
            }
        }
    );
});

app.get('/depremler-kandilli', async function (req, res) {
    var myEarthquakes = [];
    var vEq = await getvirtualEarthquake();
    if (typeof vEq != 'undefined' && Object.keys(vEq).length !== 0) {
        myEarthquakes.push({
            buyukluk: vEq.magnitude,
            enlem: vEq.latitude,
            boylam: vEq.longitude,
            tarih: vEq.date,
            saat: vEq.time,
            zaman: vEq.dateTime,
            sehir: vEq.city,
            ilce: vEq.district,
            yer: vEq.city + " " + vEq.district,
            derinlik: vEq.depth,
        });            
    }          
    request("http://www.koeri.boun.edu.tr/scripts/lst0.asp", (error, response, html) => {
        if (!error && response.statusCode == 200) {
            const $ = cheerio.load(html);
            const response = $("pre").text();
            var result = response.split("\n");
            result = result.splice(6, result.length + 1);
            result = result.splice(0,result.length - 2);
            result.forEach(element => {
                var earthquakeString = element.split(" ");
                var earthquake = [];
                for (var i = 0; i < earthquakeString.length; i++) {
                    if (earthquakeString[i].length > 0) {
                        earthquake.push(earthquakeString[i]);
                    }
                }
                var date = reverseDate(earthquake[0]);
                var time = earthquake[1];
                var latitude = earthquake[2];
                var longitude = earthquake[3];
                var depth = earthquake[4];
                var magnitude = earthquake[6];
                var location = earthquake[9].includes("lksel") ? earthquake[8] : earthquake[8] + " " + earthquake[9];
                var city = location.includes("(") ? location.replace(/.*\(|\).*/g, "") : '-';
                myEarthquakes.push({
                    buyukluk: magnitude,
                    enlem: latitude,
                    boylam: longitude,
                    tarih: date,
                    saat: time,
                    zaman: date + " " + time,
                    sehir: city,
                    ilce: '-',
                    yer: location,
                    derinlik: depth,
                });
            });
            if (req.query.tarih != null) {
                myEarthquakes = myEarthquakes.filter(x => x.tarih == req.query.tarih);
            }
            if (req.query.min != null) {
                myEarthquakes = myEarthquakes.filter(x => parseFloat(x.buyukluk) >= parseFloat(req.query.min));
            }
            if (req.query.max != null) {
                myEarthquakes = myEarthquakes.filter(x => parseFloat(x.buyukluk) <= parseFloat(req.query.max));
            }
            res.json(myEarthquakes);
        } else {
            res.send("Hata");
        }
    });
});

app.get('/', function (req, res) {
    if (req.session.login) {
        res.render('pages/home.ejs', {
            title: "Anasayfa",
        });
    } else {
        res.redirect("/login");    
    }
});

app.get('/login', function (req, res) {
    if (req.session.login) {
        res.redirect("/");
    } else {
        res.render('pages/login.ejs', {
            title: "Giriş",
        });
    }
});

app.get('/logout', function (req, res) {
    if (req.session.login) {
        delete req.session.login;
        res.redirect("/login");
    }
});

app.post('/login', function (req, res) {
    var username = req.body["username"];
    var password = req.body["password"];
    if (username == 'admin' && password == 'bitirme') {
        req.session.login = 'true';
        res.redirect("/");
    } else {
        res.render('pages/login.ejs', {
            title: "Giriş",
            error: "Kullanıcı adı veya şifre hatalı",
        });
    }
});

app.get('/users', function (req, res) {
    if (req.session.login) {
        db.collection("users").get().then((querySnapshot) => {
            var users = [];
            querySnapshot.forEach((doc) => {
                users.push({id : doc.id, data : doc.data()});
            });
            res.render('pages/users.ejs', {
                title: "Kullanıcılar",
                users: users,
            });
        });
    } else {
        res.redirect("/login");
    }
});

app.get('/user/:user_id', async function (req, res) {
	if (req.session.login) {
		var user_id = req.params.user_id;
        var userData = await getUserData(user_id);
        var userList = await getUserList(user_id);
        var helpRequests = await getUserHelpRequest(user_id);
        var userExist = await isUserExist(user_id);
        if (userExist) {
            res.render('pages/user.ejs', {
                title: userData.name + " " + userData.surname,
                userData: userData,
                userList: userList,
                helpRequests: helpRequests,
            });
        } else {
            res.redirect("/");
        }
	} else {
		res.redirect("/login");
	}
});

app.get('/depremler', function (req, res) {
    if (req.session.login) {
        var url = req.query.kaynak == 'kandilli' ? ""+domain+"depremler-kandilli" : ""+domain+"depremler-afad";
        var kaynak = req.query.kaynak == 'kandilli' ? 'kandilli' : 'afad';
        var kaynak2 = req.query.kaynak == 'kandilli' ? 'Kandilli' : 'Afad';
        request({url:url}, function(error, response, body) {
            if (!error && response.statusCode == 200) {
                var earthquakes = JSON.parse(response.body);
                if (req.query.tarih != '' && req.query.tarih != null) {
                    var tarih = req.query.tarih;
                    earthquakes = earthquakes.filter(x => x.tarih == req.query.tarih);
                } else {
                    var tarih = '';
                }
                if (req.query.min != '' && req.query.min != null) {
                    var min = req.query.min;
                    earthquakes = earthquakes.filter(x => parseFloat(x.buyukluk) >= parseFloat(req.query.min));
                } else {
                    var min = '';
                }
                if (req.query.max != '' && req.query.max != null) {
                    var max = req.query.max;
                    earthquakes = earthquakes.filter(x => parseFloat(x.buyukluk) <= parseFloat(req.query.max));
                } else {
                    var max = '';
                }
                res.render('pages/earthquakes.ejs', {
                    title: "Depremler",
                    earthquakes: earthquakes,
                    kaynak: kaynak,
                    kaynak2: kaynak2,
                    min: min,
                    max: max,
                    tarih: tarih
                });   
            } else {
                res.redirect("/");
            }
        }); 
    } else {
        res.redirect("/login");
    }
});

app.get('/create-earthquake', async function (req, res) {
    if (req.session.login) {
        var virtualEarthquake = await getvirtualEarthquake();
        res.render('pages/create-earthquake.ejs', {
            title: "Sanal Deprem Oluştur",
            vEq : virtualEarthquake
        });
    } else {
        res.redirect("/login");    
    }
});

app.post('/create-earthquake', async function (req, res) {
    var city = req.body["city"];
    var district = req.body["district"];
    var date = req.body["date"];
    var time = req.body["time"];
    var latitude = req.body["latitude"];
    var longitude = req.body["longitude"];
    var magnitude = req.body["magnitude"];
    const docRef = db.collection("eqControl").doc("virtualEarthquake");
    docRef.set({
        latitude: latitude,
        longitude: longitude,
        date: date,
        time: time,
        dateTime: date + " " + time,
        city: city,
        district: district,
        magnitude: magnitude,
        depth: '5'
    });
    var virtualEarthquake = await getvirtualEarthquake();
    res.render('pages/create-earthquake.ejs', {
        title: "Sanal Deprem Oluştur",
        success: "Deprem başarıyla oluşturuldu.",
        vEq : virtualEarthquake,
    });
});

app.post('/delete-earthquake', async function (req, res) {
    db.collection("eqControl").doc("virtualEarthquake").delete();
    var virtualEarthquake = await getvirtualEarthquake();
    res.render('pages/create-earthquake.ejs', {
        title: "Sanal Deprem Oluştur",
        success: "Deprem başarıyla silindi.",
        vEq : virtualEarthquake,
    });
});

app.post('/trigger', async function (req, res) {
	var url = ""+domain+"depremler-afad?min=4";
	request({url: url, json: true }, function (error, response, deprem) {
		if (!error && response.statusCode === 200) {
			var tarih = deprem[0].tarih;
			var saat = deprem[0].saat;
            var zaman = deprem[0].zaman;
			var enlem = deprem[0].enlem;
			var boylam = deprem[0].boylam;
			var derinlik = deprem[0].derinlik;
			var buyukluk = deprem[0].buyukluk;
			var sehir = deprem[0].sehir;
			var ilce = deprem[0].ilce;
			var yer = deprem[0].yer;
			console.log(url);
			if (buyukluk >= 4.5 && buyukluk < 5.5) {
				db.collection("eqControl")
					.doc("lastEarthquake")
					.get()
					.then(function (doc) {
						console.log(doc.data());
                        var dateTime = doc.data().dateTime;
						if (dateTime != zaman) {
							db.collection("earthquakes").add({
								latitude: enlem,
								longitude: boylam,
								date: tarih,
								time: saat,
                                dateTime: zaman,
								city: sehir,
								district: ilce,
								magnitude: buyukluk,
                                depth: derinlik
							})
							.then(function(docRef) {
								var eqId = docRef.id;
								db.collection("users")
									.get()
									.then((querySnapshot) => {
										querySnapshot.forEach((doc) => {
											var firstLocation = doc.data().firstLocation;
											var lastLocation = doc.data().lastLocation;
											var distance1 = 200;
											var distance2 = 200;
											if (typeof firstLocation !== "undefined") {
												firstLocation = firstLocation.replace(/\s/g, "");
												var res1 = firstLocation.split(",");
												var lat1 = res1[0];
												var lon1 = res1[1];
												var distance1 = calcCrow(lat1, lon1, enlem, boylam);
											}
											if (typeof lastLocation !== "undefined") {
												lastLocation = lastLocation.replace(/\s/g, "");
												var res2 = lastLocation.split(",");
												var lat2 = res2[0];
												var lon2 = res2[1];
												var distance2 = calcCrow(lat2, lon2, enlem, boylam);
											}
											if (distance1 < 101 || distance2 < 101) {
												var notifyToken = doc.data().notifyToken;
												var title = "Depremi hissettiniz mi?";
												var body = yer + " bölgesindeki depremi hissettiniz mi? Hemen durumunu bildir.";
												var message = {
												  data: {
													notification_id: '2',
													earthquake_id: eqId,
													magnitude: buyukluk
												  },
												  token: notifyToken,
												  notification: {title: title, body: body},
												};
												admin.messaging().send(message)
												  .then((response) => {
													console.log('Bildirim gönderildi:', response);
												  })
												  .catch((error) => {
													console.log('Hata:', error);
												  });
											}
										});
									});
							});
							const docRef = db.collection("eqControl").doc("lastEarthquake");
							docRef.set({
								latitude: enlem,
								longitude: boylam,
								date: tarih,
								time: saat,
                                dateTime: zaman,
								city: sehir,
								district: ilce,
								magnitude: buyukluk,
                                depth: derinlik
							});
						}
					});
			}
			else if (buyukluk >= 5.5) {
				db.collection("eqControl")
					.doc("lastEarthquake")
					.get()
					.then(function (doc) {
						var dateTime = doc.data().dateTime;
						if (dateTime != zaman) {
							db.collection("earthquakes").add({
								latitude: enlem,
								longitude: boylam,
								date: tarih,
								time: saat,
                                dateTime: zaman,
								city: sehir,
								district: ilce,
								magnitude: buyukluk,
                                depth: derinlik
							})
							.then(function(docRef) {
								var eqId = docRef.id;
								db.collection("users")
									.get()
									.then((querySnapshot) => {
										querySnapshot.forEach((doc) => {
											var firstLocation = doc.data().firstLocation;
											var lastLocation = doc.data().lastLocation;
											var distance1 = 200;
											var distance2 = 200;
											if (typeof firstLocation !== "undefined") {
												firstLocation = firstLocation.replace(/\s/g, "");
												var res1 = firstLocation.split(",");
												var lat1 = res1[0];
												var lon1 = res1[1];
												var distance1 = calcCrow(lat1, lon1, enlem, boylam);
											}
											if (typeof lastLocation !== "undefined") {
												lastLocation = lastLocation.replace(/\s/g, "");
												var res2 = lastLocation.split(",");
												var lat2 = res2[0];
												var lon2 = res2[1];
												var distance2 = calcCrow(lat2, lon2, enlem, boylam);
											}
											if (distance1 < 101 || distance2 < 101) {
												var notifyToken = doc.data().notifyToken;
												var title = "Güvende misiniz?";
												var body = yer + " bölgesindeki depremde güvende misiniz? Hemen durumunu bildir.";
												var message = {
												  data: {
													notification_id: '2',
													earthquake_id: eqId,
													magnitude: buyukluk
												  },
												  token: notifyToken,
												  notification: {title: title, body: body},
												};
												admin.messaging().send(message)
												  .then((response) => {
													console.log('Bildirim gönderildi:', response);
												  })
												  .catch((error) => {
													console.log('Hata:', error);
												  });
											}
										});
									});
							});
							const docRef = db.collection("eqControl").doc("lastEarthquake");
							docRef.set({
								latitude: enlem,
								longitude: boylam,
								date: tarih,
								time: saat,
                                dateTime: zaman,
								city: sehir,
								district: ilce,
								magnitude: buyukluk,
                                depth: derinlik
							});
						}
					});
			}
		}
	});
    var virtualEarthquake = await getvirtualEarthquake();
    res.render('pages/create-earthquake.ejs', {
        title: "Sanal Deprem Oluştur",
        success: "Tetikleme başarılı.",
        vEq : virtualEarthquake,
    });
});

async function getUserData(user_id) {
    const snapshot = await db.collection('users').doc(user_id).get();
    return snapshot.data();
}

async function getUserList(user_id) {
    var list = [];
    const snapshot = await db.collection("users").doc(user_id).get();
    var users = snapshot.data().userList;
    if (users !== undefined) {
        for (const user of users) {
            list.push({
                displayName : user.displayName,
                phoneNumber : user.phoneNumber
            })
        }
    }
    return list;
}

async function getUserHelpRequest(user_id) {
    var helpRequests = [];
    const snapshot = await db.collection("allNotifications").doc(user_id).get();
    var notifications = snapshot.data().notify;
    for (const notification of notifications) {
        var userData = await getUserData(notification.senderId);
        helpRequests.push({data: notification, sender: userData.name + " " + userData.surname})
    }
    return snapshot.exists ? helpRequests : []; 
}

async function isUserExist(user_id) {
    const snapshot = await db.collection('users').doc(user_id).get();
    return snapshot.exists;
}

async function getvirtualEarthquake() {
    const snapshot = await db.collection('eqControl').doc('virtualEarthquake').get();
    return snapshot.exists ? snapshot.data() : {};
}

function reverseDate(date) {
    dateArray = date.split(".");
    dateArray.reverse();
    return dateArray.join(".");
}

function calcCrow(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var dLat = toRad(lat2 - lat1);
    var dLon = toRad(lon2 - lon1);
    var lat1 = toRad(lat1);
    var lat2 = toRad(lat2);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c;
    return d;
}
function toRad(Value) {
    return (Value * Math.PI) / 180;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, function () {
  console.log('Sunucu çalışıyor...');
});















 


