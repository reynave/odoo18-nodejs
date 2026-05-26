import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { OdooClient } from "odoo-node";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const config = {
	url: process.env.ODOO_URL,
	db: process.env.ODOO_DB,
	login: process.env.ODOO_LOGIN,
	apiKey: process.env.ODOO_API_KEY,
	port: Number(process.env.PORT || 3000),
};
// DOC API https://www.odoo.com/documentation/18.0/developer/reference/external_api.html
let client = null;
let uid = null;
const userToken = process.env.API_TOKEN || 'test123';

function requireAuth(req, res, next) {
	const auth = req.headers["authorization"] || "";
	const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
	if (!token || token !== userToken) {
		return res.status(401).json({ error: "Unauthorized: invalid or missing Bearer token" });
	}
	next();
}

function assertConfig() {
	const required = ["ODOO_URL", "ODOO_DB", "ODOO_LOGIN", "ODOO_API_KEY"];
	const missing = required.filter((key) => !process.env[key]);
	if (missing.length) {
		throw new Error(`Missing environment variables: ${missing.join(", ")}`);
	}
}

async function getClient() {
	if (client) {
		return client;
	}

	assertConfig();
	uid = await OdooClient.authenticate({
		url: config.url,
		db: config.db,
		login: config.login,
		apiKey: config.apiKey,
	});

	client = new OdooClient({
		url: config.url,
		db: config.db,
		uid,
		apiKey: config.apiKey,
	});

	return client;
}

app.get("/health", (_req, res) => {
	res.json({ status: "ok", service: "odoo-node-rest" });
});

app.get("/api/version", async (_req, res) => {
	try {
		const odoo = await getClient();
		const version = await odoo.version();
		res.json(version);
	} catch (error) {
		res.status(500).json({ error: String(error.message || error) });
	}
});

app.get("/api/models", async (req, res) => {
	try {
		const odoo = await getClient();
		const q = String(req.query.q || "").trim().toLowerCase();
		const limit = Number(req.query.limit || 100);
		const offset = Number(req.query.offset || 0);

		const models = await odoo.models();
		const normalized = Array.isArray(models)
			? models.map((item) => {
				if (typeof item === "string") {
					return { model: item, name: item };
				}
				return {
					model: item.model || item.id || item.name || "",
					name: item.name || item.model || item.id || "",
				};
			})
			: [];

		const filtered = q
			? normalized.filter((m) => {
				const model = String(m.model || "").toLowerCase();
				const name = String(m.name || "").toLowerCase();
				return model.includes(q) || name.includes(q);
			})
			: normalized;

		const records = filtered.slice(offset, offset + limit);

		res.json({
			total: filtered.length,
			limit,
			offset,
			records,
		});
	} catch (error) {
		res.status(500).json({ error: String(error.message || error) });
	}
});

app.get("/api/models/:model/fields", async (req, res) => {
	try {
		const odoo = await getClient();
		const model = String(req.params.model || "").trim();

		if (!model) {
			return res.status(400).json({ error: "model is required" });
		}

		const fields = await odoo.fields(model);
		return res.json({ model, fields });
	} catch (error) {
		return res.status(500).json({ error: String(error.message || error) });
	}
});

app.get("/api/partners", async (req, res) => {
	try {
		const odoo = await getClient();
		const limit = Number(req.query.limit || 20);
		const offset = Number(req.query.offset || 0);
		const q = String(req.query.q || "").trim();

		const domain = q ? [["name", "ilike", q]] : [];

		const result = await odoo.searchRead("res.partner", domain, {
			fields: ["id", "name", "email", "phone", "is_company"],
			limit,
			offset,
			order: "id desc",
		});

		res.json(result);
	} catch (error) {
		res.status(500).json({ error: String(error.message || error) });
	}
});

app.post("/api/partners", async (req, res) => {
	try {
		const odoo = await getClient();
		const payload = req.body || {};

		if (!payload.name) {
			return res.status(400).json({ error: "name is required" });
		}

		const id = await odoo.create("res.partner", {
			name: payload.name,
			email: payload.email || false,
			phone: payload.phone || false,
			is_company: Boolean(payload.is_company),
		});

		return res.status(201).json({ id });
	} catch (error) {
		return res.status(500).json({ error: String(error.message || error) });
	}
});

// CUSTOM MODULE MY_LIBRARY
app.get("/api/books", requireAuth, async (req, res) => {
	try {
		const odoo = await getClient();
		const limit = Number(req.query.limit || 20);
		const offset = Number(req.query.offset || 0);
		const q = String(req.query.q || "").trim();
		const domain = q ? [["name", "ilike", q]] : [];

		const result = await odoo.searchRead("library.book", domain, {
			fields: ["id", "name", "author", "isbn", "date_release", "active", "contact"],
			limit,
			offset,
			order: "id desc",
		});

		res.json(result);
	} catch (error) {
		res.status(500).json({ error: String(error.message || error) });
	}
});

app.post("/api/books", requireAuth, async (req, res) => {
    /**
     * Create
     * curl -X POST http://localhost:3000/api/books \
     * -H "Authorization: Bearer test123" \
     * -H "Content-Type: application/json" \
     * -d '{"name":"Clean Code","author":"Robert C. Martin","isbn":"978-0132350884","date_release":"2008-08-01","contact":1,"active":true}'
     * 
     */
	try {
		const odoo = await getClient();
		const payload = req.body || {};

		if (!payload.name) {
			return res.status(400).json({ error: "name is required" });
		}

		const id = await odoo.create("library.book", {
			name: payload.name,
			author: payload.author || false,
			isbn: payload.isbn || false,
			date_release: payload.date_release || false,
			contact: payload.contact || false,
			active: payload.active !== undefined ? Boolean(payload.active) : true,
		});

		return res.status(201).json({ id });
	} catch (error) {
		return res.status(500).json({ error: String(error.message || error) });
	}
});

app.put("/api/books/:id", requireAuth, async (req, res) => {
        /**
         * Update
         * curl -X PUT http://localhost:3000/api/books/1 \
         * -H "Authorization: Bearer test123" \
         * -H "Content-Type: application/json" \
         * -d '{"author":"Uncle Bob","active":false}'
         */

	try {
		const odoo = await getClient();
		const id = Number(req.params.id);
		if (!id) {
			return res.status(400).json({ error: "id is required" });
		}

		const payload = req.body || {};
		const values = {};
		if (payload.name !== undefined) values.name = payload.name;
		if (payload.author !== undefined) values.author = payload.author;
		if (payload.isbn !== undefined) values.isbn = payload.isbn;
		if (payload.date_release !== undefined) values.date_release = payload.date_release;
		if (payload.contact !== undefined) values.contact = payload.contact;
		if (payload.active !== undefined) values.active = Boolean(payload.active);

		if (Object.keys(values).length === 0) {
			return res.status(400).json({ error: "no fields to update" });
		}

		await odoo.write("library.book", [id], values);
		return res.json({ success: true, id });
	} catch (error) {
		return res.status(500).json({ error: String(error.message || error) });
	}
});

app.delete("/api/books/:id", requireAuth, async (req, res) => {
    /**
     * Delete
     * curl -X DELETE http://localhost:3000/api/books/1 \
     * -H "Authorization: Bearer test123"
     */

	try {
		const odoo = await getClient();
		const id = Number(req.params.id);
		if (!id) {
			return res.status(400).json({ error: "id is required" });
		}

		await odoo.unlink("library.book", [id]);
		return res.json({ success: true, id });
	} catch (error) {
		return res.status(500).json({ error: String(error.message || error) });
	}
});

app.use((err, _req, res, _next) => {
	res.status(500).json({ error: String(err.message || err) });
});

app.listen(config.port, () => {
	console.log(`REST API running at http://localhost:${config.port}`);
});
