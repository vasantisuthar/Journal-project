require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const md5 = require('md5');
const passport = require('passport');
const findOrCreate = require("mongoose-findorcreate");
const passportLocalMongoose = require('passport-local-mongoose');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const MongoStore = require('connect-mongodb-session')(session)
const _ = require('lodash');
const app = express();

 var options = { year: "numeric", month: "long", day: "numeric" };
const date = new Date().toLocaleDateString('en-US',options);
app.use(express.static('public'));
app.use(bodyParser.urlencoded({extended: true}));
app.set('view engine', 'ejs');

mongoose.connect(process.env.MONGODB_URI);
var store = new MongoStore({
  uri:process.env.MONGODB_URI,
  collection:'sessions'
})
app.use(session({
  secret: process.env.COOKIE,
  resave:false,
  store:store,
  saveUninitialized:false
}));
app.use((req,res, next) =>{
  res.locals.session = req.session
  res.locals.user = req.user
  next()
})
app.use(passport.initialize());
app.use(passport.session());

// user schema
const userSchema = new mongoose.Schema({
    email:String,
    password:String,
    googleId : String

});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User =  mongoose.model('User', userSchema);

passport.use(User.createStrategy());
passport.serializeUser(function(user, done) {
    done(null, user.id);
  });

  passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
      done(err, user);
    });
  });

// blog schema
const blogSchema = new mongoose.Schema({
  userId:{
    type:mongoose.Schema.Types.ObjectId,
    ref:'User',
    required:true
  },
  title : String,
  post : String
}, {timestamps: true});

const Blog = new mongoose.model('Blog', blogSchema);

app.get('/', (req, res) => {
    res.render('index');
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/journal",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get('/auth/google',
passport.authenticate('google', { scope: ['profile'] }));

app.get('/auth/google/journal',
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/');
  });

app.get('/signup',(req, res) => {
    res.render('signup');
});

app.post('/',(req, res) =>{
    User.register({username : req.body.username}, req.body.password,(err, user) => {
      if(err){
          console.log(err);
          res.redirect('/login');
      }else{
        passport.authenticate("local")(req, res,() => {
          res.redirect('/');
          })
      }
  })
})

app.get('/login', (req, res) => {
  res.render('login');
})
app.post('/login',(req,res) => {
  const user = new User({
    username : req.body.username,
    password : req.body.password
  });

  req.login(user, (err) => {
   if(!err){
        passport.authenticate('local', { failureRedirect: '/login' })(req, res, () => {
          res.redirect('/');
      });
   }
})
});

app.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/login');
})

app.get('/blogs', (req, res) => {
  if(req.isAuthenticated()){
     Blog.find({userId : req.user._id},null,{sort: {'createdAt' : -1}},(err, foundBlogs) => {
      if(!err){
        if(foundBlogs){
          res.render('blogs',{blogs : foundBlogs, day : date });
        }
      }
    })
  }
});

app.get('/compose',(req, res) => {
  if(req.isAuthenticated()){
    res.render('compose');
  }else{
    res.redirect('/login');
  }
});

app.post('/blogs',(req, res) =>{
  const blog = new Blog({
    userId: req.user._id,
    title : _.capitalize(req.body.title),
    post : req.body.post
  });
  blog.save();
  res.redirect('/blogs');
});

app.get('/:titleName', (req, res) => {
  const titleName = req.params.titleName;
  Blog.findOne({title:titleName},(err, foundBlog) => {
    if(!err){
      if(foundBlog){
        res.render('post',{title : foundBlog.title, post: foundBlog.post,id: foundBlog._id, day: date});
      }
    }
  })
})

app.post('/search',(req, res) => {
  const search = _.capitalize(req.body.search);
  Blog.findOne({title : search},(err, foundBlog) => {
    if(!err){
      if(foundBlog){
        res.render('post',{title : foundBlog.title, post: foundBlog.post, id: foundBlog._id, day: date});
      }else{
        res.redirect('/blogs');
      }
    }
  })
});

app.post('/delete',(req, res) =>{
    const deleteBlog = req.body.blog;
    Blog.deleteOne({_id: deleteBlog},(err) => {
      if(!err){

          res.redirect('/blogs');

      }
    })
});

app.get('/edit',(req, res) =>{
  res.render('edit');
})
app.post('/edit',(req, res) => {
  const selectedId = req.body.blog;
   Blog.findOne({_id: selectedId},(err, foundBlog) => {
     if(!err){
      res.render('edit',{title: foundBlog.title, post: foundBlog.post, id: foundBlog._id});

    }
   })
});

app.post('/updateBlog',(req, res) => {
  const id= req.body.id;
  const title = _.capitalize(req.body.title);
  const post = req.body.post;
  const updateObject = {title,post};
  Blog.findByIdAndUpdate(id, updateObject,(err, foundBlog)=> {
    if (!err){
      res.redirect('/blogs');
  }
  })
})


 app.listen(3000, () => {
    console.log("server at port 3000");
})


