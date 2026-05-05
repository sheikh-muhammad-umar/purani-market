import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ExperimentsController } from './experiments.controller.js';
import { ExperimentsService } from './experiments.service.js';
import { Experiment, ExperimentSchema } from './schemas/experiment.schema.js';
import {
  ExperimentEvent,
  ExperimentEventSchema,
} from './schemas/experiment-event.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Experiment.name, schema: ExperimentSchema },
      { name: ExperimentEvent.name, schema: ExperimentEventSchema },
    ]),
  ],
  controllers: [ExperimentsController],
  providers: [ExperimentsService],
  exports: [ExperimentsService],
})
export class ExperimentsModule {}
