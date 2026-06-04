import { IsString, IsNotEmpty } from 'class-validator';

export class JoinOrderTrackingDto {
    @IsString()
    @IsNotEmpty()
    orderId: string;
}
