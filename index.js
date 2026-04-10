require("dotenv").config();
const express = require("express");
const cors = require("cors");
const postgres = require("postgres") ;

const app = express();
const port = process.env.PORT || 3000;

// ====================== MiddleWire ===================================
app.use(cors());
app.use(express.json());

const connectionString = process.env.DATABASE_URL
const sql = postgres(connectionString)

// ============================ Test Api ===================================
app.get("/", (req, res) => {
  res.send(" Running !");
});

async function run() {
  try {

    // ---------------- APi to get all user Information from database Database -------------------- 
    app.get("/users",async(req,res)=>{
        const query = sql`SELECT * FROM users`
        const result = await query
        res.json(result) ;
    })

    // ---------------- APi to Save user Information to Database -------------------- 
    app.post("/users",async(req,res)=>{
        const {name,email} = req.body ;
        const existingUser =await sql`SELECT * FROM users WHERE email = ${email}` ;
        if(existingUser > 0){
            res.send("Already Exist")
        }
        const result = await sql `INSERT INTO users (name,email) VALUES (${name},${email}) RETURNING id`
        const id = result[0].id
        res.send({id})
    })

    const result = await sql`SELECT 1 AS connected`; 
    console.log("Successfully connected to Supabase/PostgreSQL!", result);
  } catch (err) {
    console.error("Connection failed:", err);
  }
}




run().catch(console.dir);

app.listen(port, () => console.log(`Server running on port ${port}`));