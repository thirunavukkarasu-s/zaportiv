const Koa = require('koa')
const Router = require('koa-router')
const { koaBody } = require('koa-body')
const url = require('url')
const sql = require('mssql');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const compress = require('koa-compress')

const app = new Koa()
const router = new Router()

const config = {
    user: 'sa',
    password: 'smtools',
    server: 'LAPTOP-6QPR18MT', 
    database: 'korvin',
    options: {
      encrypt: false, 
      enableArithAbort: true, 
    },
  };
  
  // Create a SQL Server pool
  const poolPromise = new sql.ConnectionPool(config)
    .connect()
    .then((pool) => {
      console.log('Connected to SQL Server database');
      return pool;
    })
    .catch((err) => {
      console.error('Error connecting to SQL Server:', err);
      process.exit(1);
    });
  
const findByPagination = async (ctx, next) => {
    try {
        const parsedUrl = url.parse(ctx.request.url)
        const segments = parsedUrl.pathname.split('/')
        const pool = await poolPromise;
        const pageNumber = segments[3]
        const pageSize = 10
        const result = await pool.request().query(`
        SELECT * FROM (
            SELECT ROW_NUMBER() OVER (ORDER BY id DESC) AS RowNum, * 
            FROM products
        ) AS t
        WHERE RowNum BETWEEN ${(pageNumber - 1) * pageSize + 1} AND ${pageNumber * pageSize}
        `);
        ctx.body = result.recordset;
        ctx.status = 200;
      } catch (err) {
        console.error('Error querying database:', err);
        ctx.status = 500;
        ctx.body = 'Error querying database';
      }
      next()
}

const findAll = async (ctx, next) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`SELECT * FROM products`);
        ctx.body = result.recordset;
        ctx.status = 200;
      } catch (err) {
        console.error('Error querying database:', err);
        ctx.status = 500;
        ctx.body = 'Error querying database';
      }
      next()
}

const findById = async (ctx, next) => {
    try {
        const parsedUrl = url.parse(ctx.request.url)
        const segments = parsedUrl.pathname.split('/')
        const pool = await poolPromise;
        const result = await pool.request().query(`SELECT p.*, c.name as CategoryName FROM products p join categories c on p.categoryid = c.id where p.id = ${segments[2]}`);
        ctx.body = result.recordset;
        ctx.status = 200
      } catch (err) {
        console.error('Error querying database:', err);
        ctx.status = 500;
        ctx.body = 'Error querying database';
      }
      next()
}

const checkLogin = async (ctx, next) => {
    const { username, password } = ctx.request.body;
    console.log(await bcrypt.hash(password, 10))
    try {
      const pool = await poolPromise;
      const result = await pool
        .request()
        .input('Username', sql.NVarChar, username)
        .query('SELECT u.*, r.Code Role FROM Users u join Roles r on u.RoleId = r.Id WHERE u.name = @Username');
  
      if (!result.recordset || result.recordset.length === 0) {
        ctx.status = 401;
        ctx.body = 'Invalid username or password';
        return;
      }
  
      const user = result.recordset[0];
      const passwordMatch = await bcrypt.compare(password, user.Password);
      if (!passwordMatch) {
        ctx.status = 401;
        ctx.body = 'Invalid username or password';
        return;
      }
  
      // Generate JWT token
      const token = jwt.sign({ userId: user.Id, role: user.Role }, 'your_secret_key', { expiresIn: '1h' });
      ctx.status = 200;
      ctx.body = { token };
    } catch (err) {
      console.error('Error during login:', err);
      ctx.status = 500;
      ctx.body = 'Error during login';
    }
  
    next();
  };

const create = async (ctx, next) => {
    const { name, code, description, categoryId, price, availability } = ctx.request.body;
    console.log(name, code, description, categoryId, price, availability)
    try {
      const pool = await poolPromise;
      const result = await pool
        .request()
        .input('Name', sql.NVarChar, name)
        .input('Code', sql.NVarChar, code)
        .input('Description', sql.NVarChar, description || null)
        .input('CategoryId', sql.Int, categoryId || null)
        .input('Price', sql.Decimal(18, 2), price)
        .input('Availability', sql.Int, availability)
        .query(`
          INSERT INTO Products (Name, Code, Description, CategoryId, Price, Availability)
          VALUES (@Name, @Code, @Description, @CategoryId, @Price, @Availability);
  
          SELECT SCOPE_IDENTITY() AS InsertedProductId;
        `);
      ctx.body = { success: true, productId: result.recordset[0].InsertedProductId };
      console.log(ctx.body)
      ctx.status = 201
      next()
    } catch (err) {
      console.error('Error adding product:', err);
      ctx.status = 500;
      ctx.body = { success: false, message: 'Error adding product' };
    }
    
}

const findByCategoryId = async (ctx, next) => {
    try {
        const parsedUrl = url.parse(ctx.request.url)
        const segments = parsedUrl.pathname.split('/')
        const pool = await poolPromise;
        const result = await pool.request().query(`SELECT p.*, c.name as CategoryName FROM products p join categories c on p.categoryid = c.id where c.id = ${segments[3]}`);
        ctx.body = result.recordset;
        ctx.status = 200;
      } catch (err) {
        console.error('Error querying database:', err);
        ctx.status = 500;
        ctx.body = 'Error querying database';
      }
      next()
}

const verifyToken = async (ctx, next) => {
    const authorizationHeader = ctx.request.headers.authorization;
  
    if (!authorizationHeader) {
      ctx.status = 401;
      ctx.body = 'Unauthorized: Missing token';
      return;
    }
    const token = authorizationHeader.split(' ')[1];
  
    try {
      const decodedToken = jwt.verify(token, 'your_secret_key');
      ctx.state.user = decodedToken;
      console.log(ctx.state.user)
      await next(); // Proceed to the next middleware
    } catch (err) {
      ctx.status = 401;
      ctx.body = 'Unauthorized: Invalid token';
    }
  };

  const checkIsAdmin = async (ctx, next) => {
    if (ctx.state.user.role == 'admin') {
        await next();
    } else {
      ctx.status = 403;
      ctx.body = 'You are unauthorized for creating product!';
    }
  };

  const validateProductInput = (ctx, next) => {
    const { name, code, description, categoryId, price, availability } = ctx.request.body;
    if (!name || !code || !price || !availability) {
        ctx.status = 400;
        ctx.body = { error: 'Missing required fields' };
        return;
    }
    // Additional validation logic for specific fields (e.g., check if price is a number)
    if (isNaN(parseFloat(price))) {
        ctx.status = 400;
        ctx.body = { error: 'Price must be a number' };
        return;
    }
    if (isNaN(categoryId) || !Number.isInteger(categoryId)) {
        ctx.status = 400;
        ctx.body = { error: 'Category Id must be a valid number' };
        return;
    }
    return next();
};
  

app.use(compress()) //to compress large data set

router.post('/login', koaBody(), checkLogin)

router.get('/products/page/:number', verifyToken,  findByPagination) //for pagination

router.get('/products', verifyToken,  findAll) 

router.get('/products/:id', verifyToken, findById)

router.get('/products/category/:id', verifyToken, findByCategoryId)

router.post('/products', verifyToken, checkIsAdmin, koaBody(), validateProductInput, create)

app.use(router.routes())

app.listen(3000)
