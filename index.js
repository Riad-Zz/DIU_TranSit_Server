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

const decoded = Buffer.from(process.env.FIREBASE_KEY, "base64").toString(
  "utf8",
);

// console.log(process.env.FIREBASE_KEY)

const serviceAccount = JSON.parse(decoded);

// const serviceAccount = require("./routesyncc-firebase-adminsdk.json");

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
    app.get("/users", fireBaseTokenVarify, async (req, res) => {
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
    app.post("/users", fireBaseTokenVarify, async (req, res) => {
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

    //-------------------------- APi to add varified student a role --------------------------
    app.patch("/users", async (req, res) => {
      const { user_id } = req.body;
      const result =
        await sql`update users set role = 'student' where id = ${user_id}`;
      res.send(result);
    });

    //-------------------------- APi to add Varified student to student table --------------------------
    app.post("/student", async (req, res) => {
      const { studentId, edu_mail, user_id } = req.body;

      try {
        const result = await sql`
      INSERT INTO student (student_id, user_id, edu_mail)
      VALUES (${studentId}, ${user_id}, ${edu_mail})
      RETURNING id
    `;

        res.send({ id: result[0].id });
      } catch (error) {
        if (error.code === "23505") {
          return res.status(400).send({
            message: "Student ID or Email already exists",
          });
        }

        // other errors
        res.status(500).send({ message: "Student ID or Email already exists" });
      }
    });

    // ----------------- get student by user id ------------------
    app.get("/student/:id", async (req, res) => {
      const { id } = req.params;
      const result = await sql`SELECT * FROM student WHERE user_id = ${id}`;
      res.json(result);
    });

    // -------------------------- APi to get Combine Student Info from user + Student Table --------------------------
    app.get("/studentinfo", async (req, res) => {
      const query = sql`select users.name , student.student_id , student.edu_mail , student.department,student.academic_year,student.academic_semester,student.card_status 
                        from users 
                        join student on users.id = student.user_id `;
      const result = await query;
      res.json(result);
    });

    //-------------------------- APi to get schedule by day and also filter by starting ending locaion --------------------------
    app.get("/schedule", async (req, res) => {
      const { day, from, to } = req.query;

      try {
        let query = sql`SELECT * FROM bus_routes WHERE day = ${day}`;

        if (from) query = sql`${query} AND stops_str ILIKE ${"%" + from + "%"}`;
        if (to) query = sql`${query} AND stops_str ILIKE ${"%" + to + "%"}`;

        const routes = await query;

        const filtered = routes.filter((route) => {
          if (from && to) {
            const stops = route.stops_str
              .split(", ")
              .map((s) => s.toLowerCase());
            const fromIndex = stops.indexOf(from.toLowerCase());
            const toIndex = stops.indexOf(to.toLowerCase());

            return fromIndex < toIndex;
          }
          return true;
        });

        res.json(filtered);
      } catch (error) {
        res.status(500).json({ error: "Database error" });
      }
    });

    // ------------------- api to get all the busses --------------------
    app.get("/busses", async (req, res) => {
      const query = sql`select route_id,"from","to" ,seats,price,day from bus_routes`;
      const result = await query;
      res.json(result);
    });

    //-------------------------- api to get bus details by id --------------------------
    app.get("/busses/:id", fireBaseTokenVarify, async (req, res) => {
      const { id } = req.params;
      const query = sql`select * from bus_routes where id = ${id}`;
      const result = await query;
      res.json(result);
    });

    // --- Bus Routes API ---

    //------------------------- Get all busses with optional day filter -------------------------
    app.get("/manage-busses", async (req, res) => {
      const { day } = req.query;
      let query;
      if (day && day !== "All") {
        query = sql`SELECT * FROM bus_routes WHERE day = ${day} ORDER BY id DESC`;
      } else {
        query = sql`SELECT * FROM bus_routes ORDER BY id DESC`;
      }
      const result = await query;
      res.json(result);
    });

    //------------------------- Add new bus route -------------------------
    app.post("/bus-routes", async (req, res) => {
      const {
        route_id,
        from,
        to,
        from_time,
        to_time,
        price,
        seats,
        day,
        stops_str,
      } = req.body;
      const result = await sql`
        INSERT INTO bus_routes (route_id, "from", "to", from_time, to_time, price, seats, day, stops_str)
        VALUES (${route_id}, ${from}, ${to}, ${from_time}, ${to_time}, ${price}, ${seats}, ${day}, ${stops_str})
        RETURNING id`;
      res.json(result[0]);
    });

    //-------------------- Delete bus route -------------------------
    app.delete("/bus-routes/:id", async (req, res) => {
      const { id } = req.params;
      await sql`DELETE FROM bus_routes WHERE id = ${id}`;
      res.json({ success: true });
    });

    // --- Student/User Management API ---
    app.get("/admin/students", async (req, res) => {
      const result = await sql`
        SELECT users.id as user_id, users.name, student.student_id, student.edu_mail, 
               student.department, student.academic_year, student.academic_semester, student.card_status,student.id as student_id
        FROM users 
        LEFT JOIN student ON users.id = student.user_id`;
      res.json(result);
    });

    // ---------------------------- UPDATE BUS ROUTE API ----------------------------
    app.patch("/bus-routes/:id", async (req, res) => {
      const { id } = req.params;
      const {
        route_id,
        from,
        to,
        from_time,
        to_time,
        price,
        seats,
        day,
        stops_str,
      } = req.body;

      try {
        const result = await sql`
            UPDATE bus_routes 
            SET 
                route_id = ${route_id},
                "from" = ${from},
                "to" = ${to},
                from_time = ${from_time},
                to_time = ${to_time},
                price = ${price},
                seats = ${seats},
                day = ${day},
                stops_str = ${stops_str}
            WHERE id = ${id}
            RETURNING *`;

        if (result.length === 0) {
          return res.status(404).json({ error: "Route not found" });
        }

        res.json({
          success: true,
          message: "Route updated successfully",
          data: result[0],
        });
      } catch (error) {
        console.error("Database Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    // -------------------------- Promote Admin (Set role to admin) --------------------------
    app.patch("/admin/users/promote/:id", async (req, res) => {
      const { id } = req.params;
      try {
        await sql`UPDATE users SET role = 'admin' WHERE id = ${id}`;
        res.status(200).send({ message: "Role updated to admin" });
      } catch (error) {
        res.status(500).send({ error: "Promotion failed" });
      }
    });

    // -------------------------- Revoke (Set role to user and delete student entry using student_id) --------------------------
    app.patch("/admin/users/revoke/:id", async (req, res) => {
      const { id } = req.params;
      const { student_id } = req.body;

      try {
        await sql`UPDATE users SET role = 'user' WHERE id = ${id}`;

        if (student_id) {
          await sql`DELETE FROM student WHERE id = ${student_id}`;
        }

        res
          .status(200)
          .send({ message: "Revoked to user and student record deleted" });
      } catch (error) {
        res.status(500).send({ error: "Revoke failed" });
      }
    });

    // -------------------------- Delete (Total removal from users table + student table) --------------------------
    app.delete("/admin/users/:id", async (req, res) => {
      const { id } = req.params;
      const { student_id } = req.body;

      try {
        if (student_id) {
          await sql`DELETE FROM student WHERE id = ${student_id}`;
        } else {
          await sql`DELETE FROM student WHERE user_id = ${id}`;
        }
        await sql`DELETE FROM users WHERE id = ${id}`;
        res
          .status(200)
          .send({ message: "User and associated student data deleted." });
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Total deletion failed." });
      }
    });

    // Api to add info to applied list , update user name and update student info in student table 
    app.post("/apply-transport-card", async (req, res) => {
      const {
        studentId,
        fullName,
        department,
        academicYear,
        academicSemester,
        paidAmount,
      } = req.body;

      try {
        const student = await sql`
            SELECT id, user_id FROM student WHERE student_id = ${studentId}
        `;

        if (student.length === 0) {
          return res.status(404).send({ message: "Student not found" });
        }

        const studentPk = student[0].id;
        const userId = student[0].user_id;

        // 1. Insert into card_apply table
        await sql`
            INSERT INTO card_apply (student_id, paid_amount, name, created_at)
            VALUES (${studentPk}, ${paidAmount}, ${fullName}, NOW())
        `;

        // 2. Update student table with academic info
        await sql`
            UPDATE student
            SET department = ${department},
                academic_year = ${academicYear},
                academic_semester = ${academicSemester},
                card_status = 'pending'
            WHERE id = ${studentPk}
        `;

        // 3. Update users table name
        await sql`
            UPDATE users
            SET name = ${fullName}
            WHERE id = ${userId}
        `;

        res
          .status(200)
          .send({
            success: true,
            message: "Application submitted and profiles updated!",
          });
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .send({ message: "Transaction failed", error: error.message });
      }
    });

    // const result = await sql`SELECT 1 AS connected`;
    // console.log("Successfully connected to Supabase/PostgreSQL!", result);
  } catch (err) {
    console.error("Connection failed:", err);
  }
}

run().catch(console.dir);

app.listen(port, () => console.log(`Server running on port ${port}`));
