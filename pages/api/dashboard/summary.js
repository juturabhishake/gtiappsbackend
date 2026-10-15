import { PrismaClient } from "@prisma/client";
import Cors from "cors";

const prisma = new PrismaClient();

const cors = Cors({
    methods: ["POST", "OPTIONS"],
    origin: "*",
    allowedHeaders: ["Content-Type"],
    preflightContinue: true,
});

function runMiddleware(req, res, fn) {
    return new Promise((resolve, reject) => {
        fn(req, res, (result) => {
            if (result instanceof Error) return reject(result);
            return resolve(result);
        });
    });
}

function parseDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T00:00:00.000Z`);
    return date.toISOString().slice(0, 10) === value ? value : null;
}

function readNumber(row, key) {
    const match = Object.entries(row || {}).find(([name]) => name.toLowerCase() === key.toLowerCase())?.[1];
    const value = Number(match ?? 0);
    return Number.isFinite(value) ? value : 0;
}

export default async function handler(req, res) {
    try {
        await runMiddleware(req, res, cors);

        if (req.method === "OPTIONS") {
            return res.status(204).end();
        }

        if (req.method !== "POST") {
            res.setHeader("Allow", ["POST"]);
            return res.status(405).json({ message: "Method not allowed" });
        }

        const date = parseDate(req.body?.date);
        if (!date) {
            return res.status(400).json({ message: "A valid date in YYYY-MM-DD format is required." });
        }

        const rows = await prisma.$queryRaw`
            EXEC dbo.Get_Dashboard_Summary @SummaryDate = ${date}
        `;
        const row = rows[0] || {};
        return res.status(200).json({
            data: {
                productionQty: readNumber(row, "ProductionQty"),
                rejectionQty: readNumber(row, "RejectionQty"),
                totalEntries: readNumber(row, "TotalEntries"),
            },
        });
    } catch (error) {
        console.error("Failed to fetch dashboard summary:", error);
        return res.status(500).json({ message: "Unable to fetch dashboard summary." });
    }
}
