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

/* ============================================================================
   PART 2 - ALTER PROCEDURE dbo.Save_Part_rejection
   - Removed ProductDetailsXml handling.
   - Reads  transId  and  serialNo  from the XML payload.
   - If any value still carries the full "partNo|serialNo" format it is split:
       PartNo   = before last '|'
       SerialNo = after  last '|'
       TransId  = full string saved as it is
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

GO

-- Quick check (should list TransId and SerialNo, and no ProductDetailsXml):
-- SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
-- WHERE TABLE_NAME = 'RejectionEntry' ORDER BY ORDINAL_POSITION;
-- GO