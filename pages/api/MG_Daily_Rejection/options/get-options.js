import { PrismaClient } from "@prisma/client";
import Cors from 'cors';

const prisma = new PrismaClient();
const cors = Cors({ methods: ['POST', 'HEAD'], origin: "*" });

function runMiddleware(req, res, fn) {
    return new Promise((resolve, reject) => {
        fn(req, res, (result) => {
            if (result instanceof Error) return reject(result);
            return resolve(result);
        });
    });
}
const toComboBoxOptions = (items, key) => {
    return items.map((item, index) => {
        const value = `${String(item[key]).toLowerCase().replace(/ /g, '-')}-${index}`;
        const label = item[key];
        return { value, label };
    });
};

export default async function handler(req, res) {
    await runMiddleware(req, res, cors);

    if (req.method !== "POST") {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ message: `Method ${req.method} not allowed` });
    }

    const { type, shopFloor, project } = req.body;

    if (!type) {
        return res.status(400).json({ message: "Type is required." });
    }

    try {
        let results;
        let formattedResults;

        switch (type) {
            case 'shifts':
                results = await prisma.$queryRaw`EXEC SP_GetShifts`;
                formattedResults = toComboBoxOptions(results, 'ShiftName');
                break;
            case 'foundAt':
                results = await prisma.$queryRaw`EXEC SP_GetFoundAtLocations`;
                formattedResults = toComboBoxOptions(results, 'LocationName');
                break;
            case 'shopFloors':
                results = await prisma.$queryRaw`EXEC SP_GetShopFloors`;
                formattedResults = toComboBoxOptions(results, 'ShopFloor');
                break;
            case 'partNames':
                if (!shopFloor) return res.status(400).json({ message: "ShopFloor is required." });
                results = await prisma.$queryRaw`EXEC SP_GetProjectsByShopFloor @ShopFloor = ${shopFloor}`;
                formattedResults = toComboBoxOptions(results, 'Project');
                break;
            case 'partDescriptions':
                 if (!shopFloor || !project) return res.status(400).json({ message: "ShopFloor and Project are required." });
                results = await prisma.$queryRaw`EXEC SP_GetPartDescriptionsByProject @ShopFloor = ${shopFloor}, @Project = ${project}`;
                formattedResults = toComboBoxOptions(results, 'PartDesc');
                break;
            case 'operations':
                results = await prisma.$queryRaw`EXEC SP_GetOperations`;
                formattedResults = toComboBoxOptions(results, 'OperationName');
                break;
            case 'defectTypes':
                results = await prisma.$queryRaw`EXEC SP_GetDefectTypes`;
                formattedResults = toComboBoxOptions(results, 'DefectType');
                break;
            case 'dimensions':
                results = await prisma.$queryRaw`EXEC SP_GetDimensions`;
                formattedResults = results.map(d => ({
                    value: d.DimID.toString(),
                    label: `${d.DimType} | ${d.DimNo} | ${d.Nominal}`
                }));
                break;
            case 'employees':
                results = await prisma.$queryRaw`EXEC SP_GetEmployees`;
                formattedResults = results.map(e => ({
                    value: e.EmployeeID,
                    label: `${e.EmployeeName} | ${e.EmployeeID}`
                }));
                break;
            case 'statuses':
                results = await prisma.$queryRaw`EXEC SP_GetStatuses`;
                formattedResults = toComboBoxOptions(results, 'StatusName');
                break;
            case 'decisions':
                results = await prisma.$queryRaw`EXEC SP_GetDecisions`;
                formattedResults = toComboBoxOptions(results, 'DecisionName');
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