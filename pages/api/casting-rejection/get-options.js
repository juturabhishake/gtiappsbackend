import { PrismaClient } from "@prisma/client";
import Cors from 'cors';

const prisma = new PrismaClient();
const cors = Cors({ methods: ['POST'], origin: "*" });

function runMiddleware(req, res, fn) {
    return new Promise((resolve, reject) => {
        fn(req, res, (result) => {
            if (result instanceof Error) return reject(result);
            return resolve(result);
        });
    });
}

const toComboBoxOptions = (items, key) => {
    return items
        .filter(item => item[key] != null)
        .map(item => {
            const label = String(item[key]);
            const value = label.toLowerCase().replace(/[\s/.]/g, '-');
            return { value, label };
        });
};

export default async function handler(req, res) {
    await runMiddleware(req, res, cors);

    if (req.method !== "POST") {
        return res.status(405).json({ message: `Method ${req.method} not allowed` });
    }

    const { type, project, productId } = req.body;

    if (!type) {
        return res.status(400).json({ message: "Type is required." });
    }

    try {
        if (type === 'partNames') {
            if (!project) return res.status(400).json({ message: "Project is required." });
            const results = await prisma.$queryRaw`EXEC SP_GetPartNamesByProject @Project = ${project}`;
            const formattedResults = results.map(item => ({
                value: item.Product_Id.toString(),
                label: item.PartDesc
            }));
            return res.status(200).json(formattedResults);
        }
        
        if (type === 'partDetails') {
            if (!productId) return res.status(400).json({ message: "Product ID is required." });
            const result = await prisma.$queryRaw`EXEC SP_GetPartDetailsByProductId @ProductId = ${productId}`;
            return res.status(200).json(result[0] || {});
        }
        if (type === 'decisions') {
            const results = await prisma.$queryRaw`EXEC SP_GetCastingDecisions`;
            const formattedResults = toComboBoxOptions(results, 'DecisionName');
            return res.status(200).json(formattedResults);
        }
        const results = await prisma.$queryRaw`EXEC SP_GetCastingOptions @Type = ${type}`;
        let formattedResults;
        
        switch (type) {
            case 'projects':
                formattedResults = toComboBoxOptions(results, 'Project');
                break;
            case 'shifts':
                formattedResults = toComboBoxOptions(results, 'ShiftName');
                break;
            case 'foundAt':
                formattedResults = toComboBoxOptions(results, 'FoundAt');
                break;
            case 'defectTypes':
                formattedResults = toComboBoxOptions(results, 'DefectType');
                break;
            case 'defectAreas':
                formattedResults = toComboBoxOptions(results, 'DefectArea');
                break;
            case 'employees':
                formattedResults = toComboBoxOptions(results, 'EmployeeName');
                break;
            case 'operations':
                 formattedResults = toComboBoxOptions(results, 'OP');
                 break;
            default:
                return res.status(400).json({ message: "Invalid type specified." });
        }
        return res.status(200).json(formattedResults);
    } catch (error) {
        console.error(`API Error fetching ${type}:`, error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}