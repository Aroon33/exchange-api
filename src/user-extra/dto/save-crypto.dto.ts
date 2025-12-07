import { IsArray, ValidateNested, IsString } from "class-validator";
import { Type } from "class-transformer";

class CryptoAddressDto {
  @IsString()
  currency: string;

  @IsString()
  address: string;
  memoTag?: string | null;
}

export class SaveCryptoDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CryptoAddressDto)
  addresses: CryptoAddressDto[];
}



