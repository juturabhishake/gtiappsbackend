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

        const project = typeof req.body?.project === "string" ? req.body.project.trim() : "";

        if (!project) {
            return res.status(400).json({ message: "A project is required." });
        }

        const rows = await prisma.$queryRaw`
            EXEC dbo.Get_Rejection_TransIds_By_Project
                @Project = ${project}
        `;

        const data = (Array.isArray(rows) ? rows : [])
            .map((row) => {
                const transId = typeof row?.TransId === "string" ? row.TransId.trim() : "";
                if (!transId) return null;
                return {
                    value: transId,
                    label: transId,
                };
            })
            .filter(Boolean);

        return res.status(200).json({ data });
    } catch (error) {
        console.error("Failed to fetch project rejection transIds:", error);
        return res.status(500).json({ message: "Unable to fetch project rejection transIds." });
    }
}
