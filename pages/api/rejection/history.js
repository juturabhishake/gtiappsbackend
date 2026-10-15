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

function serializeSqlRow(row) {
    return Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, typeof value === "bigint" ? value.toString() : value]),
    );
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

        const startDate = parseDate(req.body?.startDate);
        const endDate = parseDate(req.body?.endDate);
        if (!startDate || !endDate) {
            return res.status(400).json({ message: "Valid startDate and endDate values in YYYY-MM-DD format are required." });
        }
        if (startDate > endDate) {
            return res.status(400).json({ message: "startDate must be on or before endDate." });
        }

        const rows = await prisma.$queryRaw`
            EXEC dbo.Get_Rejection_History
                @StartDate = ${startDate},
                @EndDate = ${endDate}
        `;
        return res.status(200).json({ data: rows.map(serializeSqlRow) });
    } catch (error) {
        console.error("Failed to fetch rejection history:", error);
        return res.status(500).json({ message: "Unable to fetch rejection history." });
    }
}
