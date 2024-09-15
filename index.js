require("dotenv").config();
const supabase = require("./constraint/database");
const express = require("express");
const cors = require("cors");
const usersRouter = require("./routers/user.router");
const surveiRouter = require("./routers/survei.router");
const artikelRouter = require("./routers/artikel.router");
const saldoRouter = require("./routers/saldo.router");
const kategoriRouter = require("./routers/kategori.router");
const googleAuth = require("./routers/auth.router");
const app = express();
const url = require("url");
const port = 3000;

app.use(express.json());

const corsConfig = cors({
  origin: (origin, callback) => {
    if (!origin || whitelist.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
});

app.use(cors(corsConfig));

app.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase.from("user").select("*").limit(1);

    if (error) throw error;

    res.status(200).json({
      statusCode: 200,
      status: "success",
      message: "Terhubung ke database Supabase",
    });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      status: "failed",
      message: "Gagal terhubung ke database",
      error: error.message,
    });
  }
});
app.use("/user", usersRouter);
app.use("/survei", surveiRouter);

app.use("/kategori", kategoriRouter);
app.use("/artikel", artikelRouter);
app.use("/saldo", saldoRouter);
app.use("/auth", googleAuth);
app.use("*", (_req, res) => res.status(404).json({ error: "Not Found" }));

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
