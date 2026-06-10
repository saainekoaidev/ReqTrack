-- US-047: レビュー形態(対面/書面)と同期ペア識別子を Task に追加
ALTER TABLE "Task" ADD COLUMN "reviewFormat" TEXT;
ALTER TABLE "Task" ADD COLUMN "reviewLinkId" TEXT;
