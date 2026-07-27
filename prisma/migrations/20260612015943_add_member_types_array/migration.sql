-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "types" "MemberType"[] DEFAULT ARRAY[]::"MemberType"[];
