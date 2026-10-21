import { PrismaClient } from "@prisma/client";
import Cors from 'cors';

const prisma = new PrismaClient();

const cors = Cors({
    methods: ['POST', 'GET', 'HEAD'],
    origin: "*",
    allowedHeaders: ['Content-Type'],
    credentials: true,
});

function runMiddleware(req, res, fn) {
    return new Promise((resolve, reject) => {
        fn(req, res, (result) => {
            if (result instanceof Error) {
                return reject(result);
            }
            return resolve(result);
        });
    });
}

export const config = {
    api: {
        bodyParser: false,
    },
};

async function readXmlPayload(req) {
    const chunks = [];
    for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf8').trim();
}

function serializeSqlRow(row) {
    if (!row || typeof row !== 'object') {
        return row ?? null;
    }
    return Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, typeof value === 'bigint' ? value.toString() : value]),
    );
}

export default async function handler(req, res) {
    try {
        await runMiddleware(req, res, cors);

        if (req.method !== "POST") {
            res.setHeader("Allow", ["POST"]);
            return res.status(405).json({ message: "Method not allowed" });
        }

        const contentType = req.headers['content-type'] || '';
        if (!contentType.includes('application/xml') && !contentType.includes('text/xml')) {
            return res.status(415).json({ message: "Content-Type must be application/xml or text/xml." });
        }

        const payload = await readXmlPayload(req);
        if (!payload) {
            return res.status(400).json({ message: "XML payload is required." });
        }

        const result = await prisma.$queryRaw`
            DECLARE @PayloadXml XML = TRY_CAST(${payload} AS XML);

            IF @PayloadXml IS NULL
                THROW 50000, 'The request body is not valid XML.', 1;

            EXEC dbo.Save_Part_rejection @Payload = @PayloadXml;
        `;

        return res.status(200).json({ message: "Inserted Successfully", data: serializeSqlRow(result[0]) });
    } catch (error) {
        console.error("Failed to save rejection entry:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        const validationError = errorMessage.match(/Message: `([^`]+)`/);
        const sqlErrorCode = errorMessage.match(/Code: `(\d+)`/);
        const isValidationError = sqlErrorCode?.[1] === '50000'
            || /^500(0[1-9]|1[0-2])$/.test(sqlErrorCode?.[1] || '');
        return res.status(isValidationError ? 400 : 500).json({
            message: validationError?.[1] || "Failed to save rejection entry.",
            ...(sqlErrorCode ? { code: sqlErrorCode[1] } : {}),
        });
    }
}
