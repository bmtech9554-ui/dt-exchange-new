import 'package:dt_exchange/core/design/appearance.dart';
import 'package:flutter/material.dart';
import '../design/tokens.dart';

class DtStepProgress extends StatelessWidget {
  const DtStepProgress({
    required this.labels,
    required this.activeStep,
    super.key,
  }) : assert(activeStep >= 0 && activeStep < labels.length);
  final List<String> labels;
  final int activeStep;
  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: List.generate(
      labels.length,
      (index) => Expanded(
        child: Semantics(
          label: 'Step ${index + 1}: ${labels[index]}',
          selected: index == activeStep,
          child: Column(
            children: [
              AnimatedContainer(
                duration: MediaQuery.disableAnimationsOf(context)
                    ? Duration.zero
                    : DtMotion.standard,
                width: 28,
                height: 28,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: index <= activeStep
                      ? dtColor(context, DtColors.softMint)
                      : dtColor(context, DtColors.background),
                ),
                child: index < activeStep
                    ? const Icon(
                        Icons.check,
                        size: 16,
                        color: Color(0xFF086750),
                      )
                    : Text('${index + 1}'),
              ),
              const SizedBox(height: 8),
              Text(
                labels[index],
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 12),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
