import express from 'express'
import api from './api/index';

const routes = express.Router();

routes.use('/api', api);

// Following route is for velog v1 compat
// Delete me on 2021
// routes.use('/atom', rss.routes());

routes.get('/', (req, res) => {
  res.send('hello world!');
});

export default routes;
