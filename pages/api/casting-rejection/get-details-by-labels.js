import { PrismaClient } from "@prisma/client";
import cors, { runMiddleware } from "../../../lib/cors";

const prisma = new PrismaClient();

export default async function handler(req, res) {
    await runMiddleware(req, res, cors);

    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ message: `Method ${req.method} not allowed` });
    }

    const { project, partDesc } = req.body;

    if (!project || !partDesc) {
        return res.status(400).json({ message: 'Project and Part Description are required.' });
    }

    try {
        const result = await prisma.$queryRaw`
            exec sp_getProductIdByLabels @Project = ${project}, @PartDesc = ${partDesc}
        `;
        
        const productId = result.length > 0 ? result[0].productId : null;
        return res.status(200).json({ productId });

    } catch (error) {
        console.error("API Error getting product ID:", error);
        return res.status(500).json({ message: "Failed to retrieve product details", error: error.message });
    }
}