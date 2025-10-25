import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type EventStatus = 'open' | 'in progress' | 'closed' | 'cancelled';

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  eventId: string;

  @Column({ length: 255 })
  eventName: string;

  @CreateDateColumn()
  dateAdded: Date;

  @Index()
  @Column()
  eventDate: Date;

  @Column()
  participants: string; // you can also use JSON if you want a list of participants

  @Index()
  @Column({
    type: 'enum',
    enum: ['open', 'in progress', 'closed', 'cancelled'],
    default: 'open',
  })
  status: EventStatus;

  @Column({ length: 255 })
  location: string;

  @Column({ length: 255 })
  organizer: string;

  @Index()
  @Column({ nullable: true })
  createdBy: string;

  @Column({ nullable: true })
  updatedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  dateModified: Date;
}
