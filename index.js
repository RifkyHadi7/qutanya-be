require('dotenv').config();

const supabase = require('./constraint/database')
const express = require('express')
const usersRouter = require("./routers/user.router");
const surveiRouter = require("./routers/survei.router");
const app = express()
const url = require('url');
const port = 3001

app.use(express.json());

app.get('/', async(req, res) => {
    try {
        const { data, error } = await supabase.from('user').select('*').limit(1);
    
        if (error) throw error;
    
        res.status(200).json({
          statusCode: 200,
          status: "success" ,
          message: 'Terhubung ke database Supabase',
          data
        });
      } catch (error) {
        res.status(500).json({
          statusCode: 500, 
          status:"failed",
          message: 'Gagal terhubung ke database',
          error: error.message
        });
      }
})
app.use("/user", usersRouter)
app.use("/survei", surveiRouter)


app.use("*", (_req, res) => res.status(404).json({ error: "Not Found" }));


// Function to print routes
function print(path, layer) {
  if (layer.route) {
    // If the layer has a route, iterate through its stack to print nested routes
    layer.route.stack.forEach(print.bind(null, path.concat(split(layer.route.path))));
  } else if (layer.name === 'router' && layer.handle.stack) {
    // If the layer is a router, iterate through its stack recursively
    layer.handle.stack.forEach(print.bind(null, path.concat(split(layer.regexp))));
  } else if (layer.method) {
    // If the layer is a route handler, print the method and path
    console.log('%s /%s',
      layer.method.toUpperCase(),
      path.concat(split(layer.regexp)).filter(Boolean).join('/'));
  }
}

function split(thing) {
  if (typeof thing === 'string') {
    return thing.split('/');
  } else if (thing.fast_slash) {
    return '';
  } else {
    var match = thing.toString()
      .replace('\\/?', '')
      .replace('(?=\\/|$)', '$')
      .match(/^\/\^((?:\\[.*+?^${}()|[\]\\\/]|[^.*+?^${}()|[\]\\\/])*)\$\//);
    return match
      ? match[1].replace(/\\(.)/g, '$1').split('/')
      : '<complex:' + thing.toString() + '>';
  }
}

// Print all routes
app._router.stack.forEach(print.bind(null, []));

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})