"use strict";
const express = require("express");
const http = require("node:http");
const cors = require("cors");
const { Server } = require("socket.io");
const config = require("./config");
const { attach } = require("./realtime");

const bootAt = Date.now();
const app = express();
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: "2mb" }));

app.get("/", (req, res) => res.send("UBM HRM socket server OK - namespace /hrm"));
app.get("/healthz", (req, res) => res.json({ ok: true, uptimeSec: Math.floor((Date.now() - bootAt) / 1000) }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: config.corsOrigin }, maxHttpBufferSize: 2e6 });
attach(io);

server.listen(config.port, () => console.log(`[hrm] socket server on :${config.port} (namespace /hrm)`));
