# Odoo 18 REST Service (Node.js)

## Prerequisites
- Node.js 24+
- Odoo user API key
- DOC 3d Party with https://www.odoo.com/documentation/18.0/developer/reference/external_api.html
- return **JSON**

## Setup
1. Copy .env.example to .env and fill values.
2. Install dependencies:
   npm install
3. Run service:
   npm start

## Endpoints
- GET /health
- GET /api/version
- GET /api/partners?limit=20&offset=0&q=search
- POST /api/partners

ex:
```
POST /api/partners body example
{
  "name": "PT Demo",
  "email": "demo@example.com",
  "phone": "08123456789",
  "is_company": true
}
```


### Example in real case with custom module
```
# Insert
curl -X POST http://localhost:3000/api/books \
  -H "Authorization: Bearer test123" \
  -H "Content-Type: application/json" \
  -d '{"name":"Clean Code","author":"Robert C. Martin","isbn":"9780132350884"}'

# Update
curl -X PUT http://localhost:3000/api/books/1 \
  -H "Authorization: Bearer test123" \
  -H "Content-Type: application/json" \
  -d '{"author":"Martin Updated"}'

# Delete
curl -X DELETE http://localhost:3000/api/books/1 \
  -H "Authorization: Bearer test123"
```

