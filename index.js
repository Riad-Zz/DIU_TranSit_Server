require("dotenv").config();
const express = require("express");
const cors = require("cors");
const postgres = require("postgres");

const app = express();
const port = process.env.PORT || 3000;

// ====================== MiddleWire ===================================
app.use(cors());
app.use(express.json());

const connectionString = process.env.DATABASE_URL;
const sql = postgres(connectionString);
const admin = require("firebase-admin");

const serviceAccount = require("./routesyncc-firebase-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});


//-------------------FireBase Token Varify---------------------------
const fireBaseTokenVarify = async (req, res, next) => {
  // console.log('my token : ', req.headers.authorization) ;
  if (!req.headers.authorization) {
    //Not authozired
    return res.status(401).send({ message: "Unauthorize Access ! " });
  }
  const token = req.headers.authorization.split(" ")[1];
  if (!token) {
    return res.status(401).send({ message: "Unauthorize Access ! " });
  }

  try {
    const userInfo = await admin.auth().verifyIdToken(token);
    // console.log(userInfo) ;
    req.token_email = userInfo.email;
    next();
  } catch {
    return res.status(401).send({ message: "Unauthorize Access ! " });
  }
    // console.log("Final Token : ", token);
};

// ============================ Test Api ===================================
app.get("/", (req, res) => {
  res.send(" Running !");
});

async function run() {
  try {
    // ---------------- APi to get all user Information from database Database --------------------
    app.get("/users",fireBaseTokenVarify ,async (req, res) => {
      const email = req.query.email;
      let query = {};
      if (email) {
        query = sql`SELECT * FROM users WHERE email=${email}`;
      } else {
        query = sql`SELECT * FROM users`;
      }
      const result = await query;
      res.json(result);
    });

    // ---------------- APi to Save user Information to Database --------------------
    app.post("/users",fireBaseTokenVarify ,async (req, res) => {
      const { name, email } = req.body;
      const existingUser =
        await sql`SELECT * FROM users WHERE email = ${email}`;
      if (existingUser.length > 0) {
        return res.send("Already Exist");
      }
      const result =
        await sql`INSERT INTO users (name,email) VALUES (${name},${email}) RETURNING id`;
      const id = result[0].id;
      res.send({ id });
    });


    // APi to add varified student a role
    app.patch("/users", async (req, res) => {
      const { user_id } = req.body;
      const result =
        await sql`update users set role = 'student' where id = ${user_id}`;
      res.send(result);
    });

    // APi to add Varified student to student table
    app.post("/student", async (req, res) => {
      const { studentId, edu_mail, user_id } = req.body;
      const result =
        await sql`INSERT INTO student(student_id,user_id,edu_mail) VALUES (${studentId},${user_id},${edu_mail}) RETURNING id`;
      const id = result[0].id;
      res.send({ id });
    });

    // app.get("/student", async (req, res) => {
    //   const { id } = req.query;
    //   const result = await sql`SELECT * FROM student WHERE id = ${id}`;
    //   res.json(result);
    // });

    // APi to get schedule by day and also filter by starting ending locaion
    app.get("/schedule",async (req, res) => {
      const { day, from, to } = req.query;

      try {
        // 1. Get routes that contain both stops (if provided)
        let query = sql`SELECT * FROM bus_routes WHERE day = ${day}`;

        if (from) query = sql`${query} AND stops_str ILIKE ${"%" + from + "%"}`;
        if (to) query = sql`${query} AND stops_str ILIKE ${"%" + to + "%"}`;

        const routes = await query;

        // 2. Filter by sequence (The "Forward Only" logic)
        const filtered = routes.filter((route) => {
          if (from && to) {
            const stops = route.stops_str
              .split(", ")
              .map((s) => s.toLowerCase());
            const fromIndex = stops.indexOf(from.toLowerCase());
            const toIndex = stops.indexOf(to.toLowerCase());

            // Return true only if 'to' comes after 'from'
            return fromIndex < toIndex;
          }
          return true;
        });

        res.json(filtered);
      } catch (error) {
        res.status(500).json({ error: "Database error" });
      }
    });

    // api to get bus details by id
    app.get("/busses/:id",fireBaseTokenVarify ,async (req, res) => {
      const { id } = req.params;
      const query = sql`select * from bus_routes where id = ${id}`;
      const result = await query;
      res.json(result);
    });

    // const result = await sql`SELECT 1 AS connected`;
    // console.log("Successfully connected to Supabase/PostgreSQL!", result);
  } catch (err) {
    console.error("Connection failed:", err);
  }
}

run().catch(console.dir);

app.listen(port, () => console.log(`Server running on port ${port}`));
