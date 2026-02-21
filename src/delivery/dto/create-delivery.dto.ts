import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsNotEmpty} from "class-validator"


export class CreateDeliveryDto {

    @ApiProperty({
        example: "Bike",
        description: "Vehicle type for delivery (Bike, Scooter, etc.)"
    })
    @IsString()
    @IsNotEmpty()
    vehicleType: string;

    @ApiProperty({ example: "DL-14-1234567890", 
        description: "Driviing License Number"
    })
    @IsString()
    @IsNotEmpty()
    licenseNumber: string;

    @ApiProperty({
        example: "KA-01-AB-1234",
        description: "Vehicle License Plate Number"
    })
    @IsString()
    @IsNotEmpty()
    vehicleLicensePlate: string;

    
}
