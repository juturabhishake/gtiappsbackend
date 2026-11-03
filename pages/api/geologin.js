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

function encodePasswordToBase64(password) {
    try {
        const encDataByte = new TextEncoder().encode(password);
        const encodedData = btoa(String.fromCharCode(...encDataByte));
        return encodedData;
    } catch (ex) {
        throw new Error("Error in base64Encode: " + ex.message);
    }
}

export default async function handler(req, res) {
    await runMiddleware(req, res, cors);

    if (req.method === "POST") {
        const { employeeId, password, latitude, longitude } = req.body;

        if (!employeeId || !password) {
            return res.status(400).json({ message: "Employee ID and password are required" });
        }

        const latNum = latitude !== undefined && latitude !== null && latitude !== '' ? Number(latitude) : null;
        const lonNum = longitude !== undefined && longitude !== null && longitude !== '' ? Number(longitude) : null;

        if (latNum === null || lonNum === null || !Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
            return res.status(400).json({ 
                message: "Location Required", 
                details: "Location coordinates are required to verify your workplace." 
            });
        }

        try {
            const encryptedPassword = encodePasswordToBase64(password);

            const result = await prisma.$queryRaw`
                EXEC SP_Check_Employee_GeoLogin 
                    @employee_id = ${employeeId}, 
                    @password = ${encryptedPassword}, 
                    @latitude = ${latNum},
                    @longitude = ${lonNum},
                    @message = NULL;
            `;

            const firstRow = result[0] || {};

            if (firstRow.Message === 'Location Restricted') {
                return res.status(403).json({
                    message: "Location Restricted",
                    allowedLocations: firstRow.AllowedLocations || ""
                });
            }

            if (firstRow.Message === 'Location Required') {
                return res.status(400).json({
                    message: "Location Required",
                    allowedLocations: firstRow.AllowedLocations || ""
                });
            }

            if (firstRow.Message === 'Invalid Credentials') {
                return res.status(401).json({ message: "Invalid Credentials" });
            }

            if (result.length > 0 && !firstRow.Message) {
                return res.status(200).json({ message: "Login Success", data: firstRow });
            }

            return res.status(401).json({ message: firstRow.Message || "Invalid Credentials" });
        } catch (error) {
            return res.status(500).json({ message: "Internal Server Error", error: error.message });
        }
    } else {
        return res.status(405).json({ message: "Method not allowed" });
    }
}

