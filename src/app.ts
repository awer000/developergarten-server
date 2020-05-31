import express, { RequestHandler, Request, Response } from 'express';
import { ApolloServer } from 'apollo-server-express';
// import depthLimit from 'graphql-depth-limit';
import compression from 'compression';
import cors from 'cors';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import logger from 'morgan'
import routes from './routes';
import { consumeUser } from './lib/token';
// import createLoaders, { Loaders } from './lib/createLoader';

import schema from './schema';

const app = express();

app.use(logger('dev'))
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(cookieParser())
app.use(compression());
app.use(consumeUser);
app.use('/', routes);

const apollo = new ApolloServer({
  schema,
  context: async ({ req, res }: { req: Request, res: Response }) => {
    try {
      // await consumeUser(ctx);
      return {
        user_id: res.locals.user_id,
        // loaders: createLoaders(),
        ip: req.ip,
        unsetCookie: () => {
          // res.cookie('access_token'),
          // res.cookie('referesh_token'),
          // ctx.cookies.set('access_token');
          // ctx.cookies.set('referesh_token');
        }
      };
    } catch (e) {
      return {};
    }
  },
});

apollo.applyMiddleware({ app, cors: false });

export default app