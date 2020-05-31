import express from 'express';
import auth from './auth';
// import files from './files';

const api = express.Router()
// api.use('/auth', auth);
api.use('/auth', auth)
// api.use('/files', files.routes());

export default api;
