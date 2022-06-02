import "reflect-metadata";
import { MikroORM } from "@mikro-orm/core";
import mikroConfig from "./mikro-orm.config";
import express from "express";
import { ApolloServer } from "apollo-server-express";
import { buildSchema } from "type-graphql";
import { HelloResolver } from "./resolvers/hello";
import { PostResolver } from "./resolvers/post";
import { UserResolver } from "./resolvers/user";
import Redis from "ioredis";
import session from "express-session";
import connectRedis from "connect-redis";
import { COOKIE_NAME, FRONTEND_SERVER, __prod__ } from "./constants";
import { MyContext } from "./types";
import cors from "cors";

const main = async () => {
	const orm = await MikroORM.init(mikroConfig);
	orm.getMigrator().up();

	const app = express();

	const RedisStore = connectRedis(session);
	const redis = new Redis();

	app.use(
		cors({
			origin: ["https://studio.apollographql.com", `${FRONTEND_SERVER}`],
			credentials: true,
		})
	);

	app.use(
		session({
			name: COOKIE_NAME,
			store: new RedisStore({
				client: redis,
				disableTouch: true,
			}),
			cookie: {
				maxAge: 1000 * 60 * 60 * 24 * 365 * 10, // 10 years
				httpOnly: true,
				sameSite: "lax", // csrf
				secure: __prod__, // cookie only works in https
				// sameSite: "none",
				// httpOnly: false,
				// secure: true,
			},
			secret: "qwizhieuafbkjdnvoisdksowesd",
			resave: false,
			saveUninitialized: false,
		})
	);

	app.set("trust proxy", 1);

	const apolloServer = new ApolloServer({
		schema: await buildSchema({
			resolvers: [HelloResolver, PostResolver, UserResolver],
			validate: false,
		}),
		context: ({ req, res }): MyContext => ({ em: orm.em.fork(), req, res, redis }),
	});

	await apolloServer.start();

	apolloServer.applyMiddleware({ app, cors: false });

	// apolloServer.applyMiddleware({
	// 	app,
	// 	cors: {
	// 		origin: ["https://studio.apollographql.com", "http://localhost:3000"],
	// 		credentials: true,
	// 	},
	// });

	app.listen(4000, () => {
		console.log("server started on localhost:4000");
	});
};

main().catch((err) => {
	console.error("Err: ", err);
});
