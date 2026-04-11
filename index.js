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

// ============================ Test Api ===================================
app.get("/", (req, res) => {
  res.send(" Running !");
});

async function run() {
  try {
    // ---------------- APi to get all user Information from database Database --------------------
    app.get("/users", async (req, res) => {
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
    app.post("/users", async (req, res) => {
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
      const { studentId, edu_mail, user_id} = req.body;
      const result =
        await sql`INSERT INTO student(student_id,user_id,edu_mail) VALUES (${studentId},${user_id},${edu_mail}) RETURNING id`;
      const id = result[0].id;
      res.send({ id });
    });


    app.get("/student", async (req, res) => {
      const { id } = req.query;
      const result = await sql`SELECT * FROM student WHERE id = ${id}`;
      res.json(result);
    });

    const result = await sql`SELECT 1 AS connected`;
    console.log("Successfully connected to Supabase/PostgreSQL!", result);
  } catch (err) {
    console.error("Connection failed:", err);
  }
}

run().catch(console.dir);

app.listen(port, () => console.log(`Server running on port ${port}`));
