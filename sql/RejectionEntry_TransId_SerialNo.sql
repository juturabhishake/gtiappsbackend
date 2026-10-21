/* ============================================================================
   RejectionEntry - TransId / SerialNo changes
   Database : juturabhishake_GTIApp
   Run PART 1, PART 2 and PART 3 in order (each part separately in SSMS).

   QR / transId format :  partNo|serialNo      e.g. 1100-060-0346|261016001
     -> PartNo   = value BEFORE '|'   (1100-060-0346)
     -> SerialNo = value AFTER  '|'   (261016001)
     -> TransId  = the FULL string, saved as it is (1100-060-0346|261016001)
   ============================================================================ */

/* ============================================================================
   PART 1 - ALTER TABLE dbo.RejectionEntry
   Adds TransId + SerialNo columns and drops the unused ProductDetailsXml column.
   ============================================================================ */
USE [juturabhishake_GTIApp]
GO

ALTER TABLE [dbo].[RejectionEntry] ADD [TransId] [nvarchar](512) NULL;
GO

ALTER TABLE [dbo].[RejectionEntry] ADD [SerialNo] [nvarchar](255) NULL;
GO

ALTER TABLE [dbo].[RejectionEntry] DROP COLUMN [ProductDetailsXml];
GO

/* ============================================================================
   PART 2 - ALTER PROCEDURE dbo.Save_Part_rejection
   - Removed ProductDetailsXml handling.
   - Reads  transId  and  serialNo  from the XML payload.
   - If any value still carries the full "partNo|serialNo" format it is split:
       PartNo   = before last '|'      SerialNo = after last '|'
       TransId  = full string saved as it is
   - INSERTS a new row the first time a TransId is saved.
     If the SAME TransId is saved again (e.g. QC section save on the next
     tab) the existing row is UPDATED - no duplicate rows.
   ============================================================================ */
USE [juturabhishake_GTIApp]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
ALTER PROCEDURE [dbo].[Save_Part_rejection]
    @Payload XML
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @Payload IS NULL
        THROW 50001, 'XML payload is required.', 1;

    IF @Payload.exist('/RejectionEntry/productId[1]') = 0
        THROW 50002, 'ProductId is required in the XML payload.', 1;

    IF @Payload.exist('/RejectionEntry/partNo[1]') = 0
        THROW 50003, 'PartNo is required in the XML payload.', 1;

    DECLARE @ProductIdText NVARCHAR(50) =
        NULLIF(LTRIM(RTRIM(@Payload.value(
            '(/RejectionEntry/productId/text())[1]', 'nvarchar(50)'
        ))), N'');

    DECLARE @ProductId INT = TRY_CONVERT(INT, @ProductIdText);

    IF @ProductId IS NULL
        THROW 50004, 'ProductId must be a valid integer.', 1;

    DECLARE @PartNo NVARCHAR(255) =
        NULLIF(LTRIM(RTRIM(@Payload.value(
            '(/RejectionEntry/partNo/text())[1]', 'nvarchar(255)'
        ))), N'');

    DECLARE @TransId NVARCHAR(512) =
        NULLIF(LTRIM(RTRIM(@Payload.value(
            '(/RejectionEntry/transId/text())[1]', 'nvarchar(512)'
        ))), N'');

    DECLARE @SerialNo NVARCHAR(255) =
        NULLIF(LTRIM(RTRIM(@Payload.value(
            '(/RejectionEntry/serialNo/text())[1]', 'nvarchar(255)'
        ))), N'');

    DECLARE @SplitSource NVARCHAR(512);
    DECLARE @PipePos INT;

    /* If any value still carries the full  partNo|serialNo  transId format,
       split on the last '|':
         PartNo   <- value BEFORE '|'
         SerialNo <- value AFTER  '|'
         TransId  <- FULL string kept as it is                            */
    SET @SplitSource =
        CASE
            WHEN @TransId LIKE N'%|%' THEN @TransId
            WHEN @PartNo  LIKE N'%|%' THEN @PartNo
            ELSE NULL
        END;

    IF @SplitSource IS NOT NULL
    BEGIN
        SET @PipePos = LEN(@SplitSource) - CHARINDEX(N'|', REVERSE(@SplitSource)) + 1;

        SET @PartNo  = LTRIM(RTRIM(LEFT(@SplitSource, @PipePos - 1)));
        SET @TransId = @SplitSource;

        IF @SerialNo IS NULL
            SET @SerialNo = LTRIM(RTRIM(SUBSTRING(@SplitSource, @PipePos + 1, 255)));
    END
    ELSE IF @TransId IS NULL AND @SerialNo IS NOT NULL
    BEGIN
        SET @TransId = @PartNo + N'|' + @SerialNo;
    END

    IF @PartNo IS NULL
        THROW 50005, 'PartNo cannot be empty.', 1;

    DECLARE @Form XML = @Payload.query('/RejectionEntry/form[1]');

    /* Extract every form field into a variable (shared by INSERT and UPDATE) */
    DECLARE @ScrapDateText NVARCHAR(30) =
        NULLIF(LTRIM(RTRIM(@Form.value('(/form/scrapDate/text())[1]', 'nvarchar(30)'))), N'');
    DECLARE @RejectedOnText NVARCHAR(30) =
        NULLIF(LTRIM(RTRIM(@Form.value('(/form/rejectedOn/text())[1]', 'nvarchar(30)'))), N'');
    DECLARE @TargetDateText NVARCHAR(30) =
        NULLIF(LTRIM(RTRIM(@Form.value('(/form/targetDate/text())[1]', 'nvarchar(30)'))), N'');

    DECLARE @ActualText NVARCHAR(50) =
        NULLIF(LTRIM(RTRIM(@Form.value('(/form/actual/text())[1]', 'nvarchar(50)'))), N'');
    DECLARE @QtyText NVARCHAR(50) =
        NULLIF(LTRIM(RTRIM(@Form.value('(/form/qty/text())[1]', 'nvarchar(50)'))), N'');

    DECLARE @ScrapDate DATE = TRY_CONVERT(DATE, @ScrapDateText, 103);
    DECLARE @RejectedOn DATE = TRY_CONVERT(DATE, @RejectedOnText, 103);
    DECLARE @TargetDate DATE = TRY_CONVERT(DATE, @TargetDateText, 103);
    DECLARE @Actual DECIMAL(18,4) = TRY_CONVERT(DECIMAL(18,4), @ActualText);
    DECLARE @Qty DECIMAL(18,3) = TRY_CONVERT(DECIMAL(18,3), @QtyText);

    IF @ActualText IS NOT NULL AND @Actual IS NULL
        THROW 50006, 'Actual must be a valid number.', 1;

    IF @QtyText IS NOT NULL AND @Qty IS NULL
        THROW 50007, 'QTY must be a valid number.', 1;

    IF @ScrapDateText IS NOT NULL AND @ScrapDate IS NULL
        THROW 50008, 'ScrapDate must use dd/MM/yyyy format.', 1;

    IF @RejectedOnText IS NOT NULL AND @RejectedOn IS NULL
        THROW 50009, 'RejectedOn must use dd/MM/yyyy format.', 1;

    IF @TargetDateText IS NOT NULL AND @TargetDate IS NULL
        THROW 50010, 'TargetDate must use dd/MM/yyyy format.', 1;


    DECLARE @FoundAt NVARCHAR(255) =
        NULLIF(LTRIM(RTRIM(@Form.value('(/form/foundAt/text())[1]', 'nvarchar(255)'))), N'');
    DECLARE @LeakCode NVARCHAR(255) =
        NULLIF(LTRIM(RTRIM(@Form.value('(/form/leakCode/text())[1]', 'nvarchar(255)'))), N'');
    DECLARE @Shift NVARCHAR(100) =
        NULLIF(LTRIM(RTRIM(@Form.value('(/form/shift/text())[1]', 'nvarchar(100)'))), N'');
    DECLARE @ShopFloor NVARCHAR(255) =
        NULLIF(LTRIM(RTRIM(@Form.value('(/form/shopFloor/text())[1]', 'nvarchar(255)'))), N'');
    DECLARE @PartName NVARCHAR(255) =
        NULLIF(LTRIM(RTRIM(@Form.value('(/form/partName/text())[1]', 'nvarchar(255)'))), N'');
    DECLARE @BhChThIm NVARCHAR(255) =
        NULLIF(LTRIM(RTRIM(@Form.value('(/form/bhChThIm/text())[1]', 'nvarchar(255)'))), N'');
    DECLARE @OP NVARCHAR(100) =
        NULLIF(LTRIM(RTRIM(@Form.value('(/form/op/text())[1]', 'nvarchar(100)'))), N'');
    DECLARE @FixPos NVARCHAR(255) =
        NULLIF(LTRIM(RTRIM(@Form.value('(/form/fixPos/text())[1]', 'nvarchar(255)'))), N'');
    DECLARE @DefectType NVARCHAR(255) =
        NULLIF(LTRIM(RTRIM(@Form.value('(/form/defectType/text())[1]', 'nvarchar(255)'))), N'');
    DECLARE @Dimension NVARCHAR(100) =
        NULLIF(LTRIM(RTRIM(@Form.value('(/form/dimension/text())[1]', 'nvarchar(100)'))), N'');
    DECLARE @OperatorName NVARCHAR(255) =
        NULLIF(LTRIM(RTRIM(@Form.value('(/form/operator/text())[1]', 'nvarchar(255)'))), N'');
    DECLARE @LeaderName NVARCHAR(255) =
        NULLIF(LTRIM(RTRIM(@Form.value('(/form/leader/text())[1]', 'nvarchar(255)'))), N'');
    DECLARE @Decision NVARCHAR(255) =
        NULLIF(LTRIM(RTRIM(@Form.value('(/form/decision/text())[1]', 'nvarchar(255)'))), N'');
    DECLARE @RejectionReason NVARCHAR(MAX) =
        NULLIF(LTRIM(RTRIM(@Form.value('(/form/reason/text())[1]', 'nvarchar(max)'))), N'');
    DECLARE @Status NVARCHAR(100) =
        NULLIF(LTRIM(RTRIM(@Form.value('(/form/status/text())[1]', 'nvarchar(100)'))), N'');
    DECLARE @CorrectiveAction NVARCHAR(MAX) =
        NULLIF(LTRIM(RTRIM(@Form.value('(/form/correctiveAction/text())[1]', 'nvarchar(max)'))), N'');
    DECLARE @CreatedBy NVARCHAR(255) =
        NULLIF(LTRIM(RTRIM(@Payload.value('(/RejectionEntry/createdBy/text())[1]', 'nvarchar(255)'))), N'');

    /* ---- INSERT a new row, or UPDATE the existing row for the same TransId ---- */
    DECLARE @RejectionEntryId BIGINT;

    IF @TransId IS NOT NULL
        SELECT TOP (1) @RejectionEntryId = RejectionEntryId
        FROM dbo.RejectionEntry
        WHERE LTRIM(RTRIM(TransId)) = LTRIM(RTRIM(@TransId));

    IF @RejectionEntryId IS NULL
    BEGIN
        INSERT INTO dbo.RejectionEntry
        (
            ProductId, PartNo, TransId, SerialNo, ScrapDate, RejectedOn, FoundAt,
            LeakCode, Shift, ShopFloor, PartName, BhChThIm, OP, FixPos, DefectType,
            Dimension, Actual, Qty, OperatorName, LeaderName, Decision,
            RejectionReason, TargetDate, Status, CorrectiveAction, CreatedBy
        )
        VALUES
        (
            @ProductId, @PartNo, @TransId, @SerialNo, @ScrapDate, @RejectedOn,
            @FoundAt, @LeakCode, @Shift, @ShopFloor, @PartName, @BhChThIm, @OP,
            @FixPos, @DefectType, @Dimension, @Actual, @Qty, @OperatorName,
            @LeaderName, @Decision, @RejectionReason, @TargetDate, @Status,
            @CorrectiveAction, @CreatedBy
        );

        SET @RejectionEntryId = CAST(SCOPE_IDENTITY() AS BIGINT);
    END
    ELSE
    BEGIN
        UPDATE dbo.RejectionEntry
        SET ProductId = @ProductId,
            PartNo = @PartNo,
            TransId = @TransId,
            SerialNo = @SerialNo,
            ScrapDate = @ScrapDate,
            RejectedOn = @RejectedOn,
            FoundAt = @FoundAt,
            LeakCode = @LeakCode,
            Shift = @Shift,
            ShopFloor = @ShopFloor,
            PartName = @PartName,
            BhChThIm = @BhChThIm,
            OP = @OP,
            FixPos = @FixPos,
            DefectType = @DefectType,
            Dimension = @Dimension,
            Actual = @Actual,
            Qty = @Qty,
            OperatorName = @OperatorName,
            LeaderName = @LeaderName,
            Decision = @Decision,
            RejectionReason = @RejectionReason,
            TargetDate = @TargetDate,
            Status = @Status,
            CorrectiveAction = @CorrectiveAction,
            CreatedBy = @CreatedBy,
            CreatedAt = SYSUTCDATETIME()
        WHERE RejectionEntryId = @RejectionEntryId;
    END

    SELECT
        @RejectionEntryId AS RejectionEntryId,
        @ProductId AS ProductId,
        @PartNo AS PartNo,
        @TransId AS TransId,
        @SerialNo AS SerialNo,
        N'Success' AS Result;
END;
GO


/* ============================================================================
   PART 3 - ALTER PROCEDURE dbo.GetProductMatrixPartDetails
   - @ProductId is now OPTIONAL (NULL default); the API sends ONLY partNo.
   - Searches the part number against Ship/Assy/Mach/Cast columns.
   - Takes TOP 1 ordered by ProductMatrix Status priority 1 -> 4 -> 3 -> 2.
     (If your status column has a different name than "Status",
      change PM.Status below to the actual column name.)
   ============================================================================ */
USE [juturabhishake_GTIApp]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
ALTER PROCEDURE [dbo].[GetProductMatrixPartDetails]
    @ProductId INT = NULL,
    @PartNo NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @SearchNo NVARCHAR(255) = NULLIF(LTRIM(RTRIM(@PartNo)), N'');

    IF @SearchNo IS NULL
        THROW 50020, 'PartNo is required.', 1;

    SELECT TOP (1) PM.*
    FROM dbo.ProductMatrix AS PM
    WHERE ( LTRIM(RTRIM(PM.Ship_PartNo)) = @SearchNo
         OR LTRIM(RTRIM(PM.Assy_PartNo)) = @SearchNo
         OR LTRIM(RTRIM(PM.Mach_PartNo)) = @SearchNo
         OR LTRIM(RTRIM(PM.Cast_PartNo)) = @SearchNo )
      AND ( @ProductId IS NULL OR PM.Product_Id = @ProductId )
    ORDER BY
        /* Status priority: 1 highest, then 4, then 3, then 2 */
        CASE TRY_CONVERT(INT, NULLIF(LTRIM(RTRIM(PM.Status)), N''))
            WHEN 1 THEN 1
            WHEN 4 THEN 2
            WHEN 3 THEN 3
            WHEN 2 THEN 4
            ELSE 5
        END,
        /* Tie-breaker: which part-number column matched */
        CASE
            WHEN LTRIM(RTRIM(PM.Ship_PartNo)) = @SearchNo THEN 1
            WHEN LTRIM(RTRIM(PM.Assy_PartNo)) = @SearchNo THEN 2
            WHEN LTRIM(RTRIM(PM.Mach_PartNo)) = @SearchNo THEN 3
            WHEN LTRIM(RTRIM(PM.Cast_PartNo)) = @SearchNo THEN 4
            ELSE 5
        END,
        PM.Product_Id;
END;
GO

/* ============================================================================
   PART 4 - CREATE PROCEDURE dbo.Get_RejectionEntry
   - Fetch a saved RejectionEntry by TransId (partNo|serialNo).
   - All lookup logic runs in SQL - no raw SELECT queries inside the Node API.
   ============================================================================ */
USE [juturabhishake_GTIApp]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[Get_RejectionEntry]
    @TransId NVARCHAR(512)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @SearchNo NVARCHAR(512) = NULLIF(LTRIM(RTRIM(@TransId)), N'');

    IF @SearchNo IS NULL
        THROW 50030, 'TransId is required.', 1;

    SELECT TOP (1) *
    FROM dbo.RejectionEntry
    WHERE TransId = @SearchNo
    ORDER BY RejectionEntryId DESC;
END;
GO

/* Optional but recommended: index on TransId for fast lookups */
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_RejectionEntry_TransId'
      AND object_id = OBJECT_ID('dbo.RejectionEntry')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_RejectionEntry_TransId]
        ON [dbo].[RejectionEntry]([TransId] ASC);
END
GO

